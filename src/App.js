import {
	Box,
	CircularProgress,
	LinearProgress,
	Typography,
} from "@mui/material";
import { useCallback, useEffect, useRef, useState } from "react";
import moment from "moment";
import "./App.css";
import Calendar from "./components/Calendar";
const ZOHO = window.ZOHO;

function extractOrgVariableValue(resp) {
	if (!resp) return "";
	if (typeof resp === "string") return resp;
	if (resp.Success && resp.Success.Content !== undefined) return resp.Success.Content;
	if (resp.Content !== undefined) return resp.Content;
	if (resp.data !== undefined) return resp.data;
	return "";
}

function parseContractorOrder(value) {
	if (!value || typeof value !== "string") return [];
	const trimmed = value.trim();
	if (!trimmed) return [];
	if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
		try {
			const parsed = JSON.parse(trimmed);
			if (Array.isArray(parsed)) {
				return parsed.map((s) => String(s).trim()).filter(Boolean);
			}
		} catch (e) {
			// fall through to line parsing
		}
	}
	return trimmed
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter(Boolean);
}

async function getZohoOrgVariable(name) {
	if (ZOHO?.CRM?.API?.getOrgVariable) {
		return ZOHO.CRM.API.getOrgVariable(name);
	}
	if (ZOHO?.CRM?.ORG?.getOrgVariable) {
		return ZOHO.CRM.ORG.getOrgVariable(name);
	}
	console.warn("No Zoho org variable API available");
	return "";
}

const LOADING_SOURCE_TOTAL = 6;

const JOB_ALLOCATION_PAGE_SIZE = 2000;

async function getJobAllocationsForRange(
	startDate,
	endDate,
	onProgress = () => {}
) {
	const allocations = [];
	let offset = 0;
	let moreRecords = true;

	while (moreRecords) {
		const response = await ZOHO.CRM.API.coql({
			select_query:
				"select id,Start_Date,End_Date,Projects,Projects.Job_Number as Job_Number,Contractor," +
				"Color_Code,Project_Summary,Current_Estimated_Time_Budget," +
				`Excluded_Dates,Type from Job_Allocations where ((Start_Date <= '${endDate}') and (End_Date >= '${startDate}')) ` +
				`order by Start_Date asc limit ${offset}, ${JOB_ALLOCATION_PAGE_SIZE}`,
		});
		const pageRecords = response?.data || [];
		allocations.push(...pageRecords);
		onProgress(allocations.length);
		moreRecords =
			Boolean(response?.info?.more_records) &&
			pageRecords.length === JOB_ALLOCATION_PAGE_SIZE;
		offset += JOB_ALLOCATION_PAGE_SIZE;
	}

	return allocations;
}

const PROJECT_SEARCH_LIMIT = 50;

// Looks up projects (any status) by name or job number. Only called when the
// search term has no match among the already-loaded active projects.
async function searchProjectsInCrm(term) {
	const safeTerm = String(term || "")
		.trim()
		.replace(/\\/g, "\\\\")
		.replace(/'/g, "\\'");
	if (!safeTerm) return [];

	const response = await ZOHO.CRM.API.coql({
		select_query:
			"select Name,Job_Number,Project_Timing,id,Work_Summary_Sale,Account_name,Budget_time_Add_Remove,Project_Status " +
			`from FP_Projects where ((Name like '%${safeTerm}%') or (Job_Number like '%${safeTerm}%')) ` +
			`limit 0, ${PROJECT_SEARCH_LIMIT}`,
	});
	return response?.data || [];
}

const monthKey = (m) => m.format("YYYY-MM");

function App() {
	const [projects, setProjects] = useState([]);
	const [painters, setPainters] = useState([]);
	const [events, setEvents] = useState([]);
	const [inProgress, setInProgress] = useState([]);
	const [blockedProjects, setBlockedProjects] = useState([]);
	const [rectification, setRectification] = useState([]);
	const [contractorOrder, setContractorOrder] = useState([]);
	const [loadingProgress, setLoadingProgress] = useState({
		isLoading: true,
		label: "Connecting to Zoho CRM…",
		counts: {},
		completedSources: [],
		totalSources: LOADING_SOURCE_TOTAL,
	});
	// Allocation cache: every allocation fetched so far (by id), plus the months
	// already covered, so navigating back to a visited month never refetches.
	const allocationCacheRef = useRef(new Map());
	const fetchedMonthsRef = useRef(new Set());
	const inFlightMonthsRef = useRef(new Set());
	const pendingRangeRequestsRef = useRef(0);

	const syncEventsFromCache = useCallback(() => {
		const all = [...allocationCacheRef.current.values()];
		setEvents(all);
		setBlockedProjects(
			all
				.filter((event) => event.Type === "Blocked")
				.map((event) => ({
					resource: event?.Contractor?.id,
					start: event?.Start_Date,
					end: event?.End_Date,
				}))
		);
	}, []);

	const handleAllocationCreated = useCallback(
		(allocation) => {
			if (!allocation?.id) return;
			allocationCacheRef.current.set(allocation.id, allocation);
			syncEventsFromCache();
		},
		[syncEventsFromCache]
	);
	const updateLoadingProgress = useCallback(
		(source, count, label, complete = false) => {
			setLoadingProgress((current) => {
				const alreadyComplete = current.completedSources.includes(source);
				const completedSources =
					complete && !alreadyComplete
						? [...current.completedSources, source]
						: current.completedSources;
				const isLoading = completedSources.length < current.totalSources;

				return {
					...current,
					isLoading,
					label: isLoading ? label : "CRM data is ready",
					counts: { ...current.counts, [source]: count },
					completedSources,
				};
			});
		},
		[]
	);
	const markLoadingSources = useCallback((sources, label) => {
		setLoadingProgress((current) => ({
			...current,
			isLoading: true,
			label,
			completedSources: current.completedSources.filter(
				(source) => !sources.includes(source)
			),
		}));
	}, []);
	const handleVisibleDateRangeChange = useCallback(
		async ({ start, end }) => {
			if (!start || !end) return;

			// Work out which whole months in view have not been fetched yet.
			const missingMonths = [];
			const cursor = moment(start, "YYYY-MM-DD").startOf("month");
			const lastMonth = moment(end, "YYYY-MM-DD").startOf("month");
			while (cursor.isSameOrBefore(lastMonth)) {
				const key = monthKey(cursor);
				if (
					!fetchedMonthsRef.current.has(key) &&
					!inFlightMonthsRef.current.has(key)
				) {
					missingMonths.push(cursor.clone());
				}
				cursor.add(1, "month");
			}
			if (missingMonths.length === 0) return;

			// Fetch each contiguous run of missing months with a single query.
			const runs = [];
			missingMonths.forEach((m) => {
				const run = runs[runs.length - 1];
				if (run && run[run.length - 1].clone().add(1, "month").isSame(m)) {
					run.push(m);
				} else {
					runs.push([m]);
				}
			});

			const label = (a, b) => `Loading calendar allocations for ${a} to ${b}…`;
			await Promise.all(
				runs.map(async (run) => {
					const keys = run.map(monthKey);
					const runStart = run[0].format("YYYY-MM-DD");
					const runEnd = run[run.length - 1]
						.clone()
						.endOf("month")
						.format("YYYY-MM-DD");
					keys.forEach((k) => inFlightMonthsRef.current.add(k));
					pendingRangeRequestsRef.current += 1;
					markLoadingSources(
						["allocations", "blockedAllocations"],
						label(runStart, runEnd)
					);

					try {
						const rangeEvents = await getJobAllocationsForRange(
							runStart,
							runEnd,
							(count) =>
								updateLoadingProgress(
									"allocations",
									allocationCacheRef.current.size + count,
									label(runStart, runEnd)
								)
						);
						rangeEvents.forEach((event) => {
							if (event?.id) allocationCacheRef.current.set(event.id, event);
						});
						keys.forEach((k) => fetchedMonthsRef.current.add(k));
						syncEventsFromCache();
					} catch (error) {
						// Months stay unmarked so they are retried on the next navigation.
						console.error("Could not load calendar allocations", error);
					} finally {
						keys.forEach((k) => inFlightMonthsRef.current.delete(k));
						pendingRangeRequestsRef.current -= 1;
						if (pendingRangeRequestsRef.current === 0) {
							const cached = [...allocationCacheRef.current.values()];
							updateLoadingProgress(
								"allocations",
								cached.length,
								"Calendar allocations loaded",
								true
							);
							updateLoadingProgress(
								"blockedAllocations",
								cached.filter((e) => e.Type === "Blocked").length,
								"Contractor availability loaded",
								true
							);
						}
					}
				})
			);
		},
		[markLoadingSources, updateLoadingProgress, syncEventsFromCache]
	);
	useEffect(() => {
		const zohoConnect = async () => {
			ZOHO.embeddedApp.on("PageLoad", function (data) {});
			await ZOHO.embeddedApp.init();

			let config = {
				select_query:
					"select Name,Job_Number,Project_Timing,id,Work_Summary_Sale,Account_name,Budget_time_Add_Remove,Project_Status from FP_Projects where ((((Project_Status = 'Requested') or (Project_Status != 'In Progress'))or(Project_Status = 'Rectification'))and(Job_Offer_Status = 'Not Allocated'))",
			};
			const projectsResp = await ZOHO.CRM.API.coql(config).then(function (
				data
			) {
				const sortedData = data.data.sort((a, b) => {
					const nameA = (a.Account_name || "").toUpperCase(); // Handle null values
					const nameB = (b.Account_name || "").toUpperCase(); // Handle null values

					if (nameA < nameB) {
						return -1;
					} else if (nameA > nameB) {
						return 1;
					} else {
						return 0;
					}
				});
				setProjects(sortedData);
				updateLoadingProgress(
					"availableProjects",
					sortedData.length,
					"Available projects loaded",
					true
				);
			});

			// (project_allocation:equals:false)

			// Query: "(Contractor_Status:equals:Active)",

			const painterData = await ZOHO.CRM.API.searchRecord({
				Entity: "Contractors",
				Type: "criteria",
				Query:
					"((Contractor_Status:equals:Active)and(Employment_Type:equals:Contractor))",
			});
			updateLoadingProgress(
				"contractors",
				painterData?.data?.length || 0,
				"Contractors loaded",
				true
			);

			const InProgressProjectData = await ZOHO.CRM.API.searchRecord({
				Entity: "FP_Projects",
				Type: "criteria",
				Query: "Project_Status:equals:In Progress",
			});

			setInProgress(InProgressProjectData.data);
			updateLoadingProgress(
				"inProgressProjects",
				InProgressProjectData?.data?.length || 0,
				"In-progress projects loaded",
				true
			);

			const rectificationData = await ZOHO.CRM.API.searchRecord({
				Entity: "FP_Projects",
				Type: "criteria",
				Query: "Project_Status:equals:Rectification",
			});

			setRectification(rectificationData.data);
			updateLoadingProgress(
				"rectificationProjects",
				rectificationData?.data?.length || 0,
				"Rectification projects loaded",
				true
			);

			setPainters(painterData.data);

			const orgVarResp = await getZohoOrgVariable("worksboard_org_var");
			setContractorOrder(parseContractorOrder(extractOrgVariableValue(orgVarResp)));

		};
		zohoConnect();
	}, [updateLoadingProgress]);
	
	const fetchedRecordCount = Object.values(loadingProgress.counts).reduce(
		(total, count) => total + count,
		0
	);
	const loadingPercent = Math.round(
		(loadingProgress.completedSources.length / loadingProgress.totalSources) *
			100
	);

	if (painters.length === 0) {
		return (
			<Box className="crm-loading-screen">
				<Box className="crm-loading-screen__card">
					<Box className="crm-loading-screen__heading">
						<CircularProgress size={26} thickness={4.5} />
						<Box>
							<Typography component="h1">Loading worksboard</Typography>
							<Typography>{loadingProgress.label}</Typography>
						</Box>
					</Box>
					<LinearProgress variant="determinate" value={loadingPercent} />
					<Typography className="crm-loading-screen__count">
						{fetchedRecordCount.toLocaleString()} records fetched ·{" "}
						{loadingProgress.completedSources.length}/
						{loadingProgress.totalSources} datasets
					</Typography>
				</Box>
			</Box>
		);
	}

	return (
		<Box sx={{ height: "100vh", overflowY: "hidden" }}>
			<Calendar
				contractors={painters}
				contractorOrder={contractorOrder}
				events={events}
				projects={projects}
				inProgress={inProgress}
				blockedProjects={blockedProjects}
				rectification={rectification}
				onSearchProjects={searchProjectsInCrm}
				loadingProgress={loadingProgress}
				onAllocationCreated={handleAllocationCreated}
				onVisibleDateRangeChange={handleVisibleDateRangeChange}
			/>
		</Box>
	);
}

export default App;
