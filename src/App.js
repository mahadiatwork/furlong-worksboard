import {
	Box,
	CircularProgress,
	LinearProgress,
	Typography,
} from "@mui/material";
import { useCallback, useEffect, useRef, useState } from "react";
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

const LOADING_SOURCE_TOTAL = 7;

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

async function getAllProjectsForSearch(onProgress = () => {}) {
	const projects = [];
	let page = 1;
	let moreRecords = true;

	while (moreRecords) {
		const response = await ZOHO.CRM.API.getAllRecords({
			Entity: "FP_Projects",
			sort_order: "asc",
			per_page: 200,
			page,
		});
		const pageRecords = response?.data || [];
		projects.push(...pageRecords);
		onProgress(projects.length);
		moreRecords = Boolean(response?.info?.more_records) && pageRecords.length > 0;
		page += 1;
	}

	const uniqueProjects = new Map();
	projects.forEach((project) => {
		if (project?.id) uniqueProjects.set(project.id, project);
	});
	return [...uniqueProjects.values()];
}

function App() {
	const [projects, setProjects] = useState([]);
	const [painters, setPainters] = useState([]);
	const [events, setEvents] = useState([]);
	const [inProgress, setInProgress] = useState([]);
	const [blockedProjects, setBlockedProjects] = useState([]);
	const [rectification, setRectification] = useState([]);
	const [contractorOrder, setContractorOrder] = useState([]);
	const [searchableProjects, setSearchableProjects] = useState([]);
	const [searchProjectsLoading, setSearchProjectsLoading] = useState(true);
	const [searchProjectsError, setSearchProjectsError] = useState("");
	const [loadingProgress, setLoadingProgress] = useState({
		isLoading: true,
		label: "Connecting to Zoho CRM…",
		counts: {},
		completedSources: [],
		totalSources: LOADING_SOURCE_TOTAL,
	});
	const visibleRangeRequestRef = useRef(0);
	const currentVisibleRangeRef = useRef("");

	const handleAllocationCreated = useCallback((allocation) => {
		setEvents((currentEvents) => {
			if (currentEvents.some((event) => event.id === allocation.id)) {
				return currentEvents;
			}
			return [...currentEvents, allocation];
		});
	}, []);
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

			const rangeKey = `${start}:${end}`;
			if (currentVisibleRangeRef.current === rangeKey) return;
			currentVisibleRangeRef.current = rangeKey;
			const requestId = ++visibleRangeRequestRef.current;
			markLoadingSources(
				["allocations", "blockedAllocations"],
				`Loading calendar allocations for ${start} to ${end}…`
			);

			try {
				const rangeEvents = await getJobAllocationsForRange(
					start,
					end,
					(count) => {
						if (requestId === visibleRangeRequestRef.current) {
							updateLoadingProgress(
								"allocations",
								count,
								`Loading calendar allocations for ${start} to ${end}…`
							);
						}
					}
				);

				if (requestId !== visibleRangeRequestRef.current) return;

				setEvents(rangeEvents);
				const blockedRanges = rangeEvents
					.filter((event) => event.Type === "Blocked")
					.map((event) => ({
						resource: event?.Contractor?.id,
						start: event?.Start_Date,
						end: event?.End_Date,
					}));
				setBlockedProjects(blockedRanges);
				updateLoadingProgress(
					"allocations",
					rangeEvents.length,
					"Calendar allocations loaded",
					true
				);
				updateLoadingProgress(
					"blockedAllocations",
					blockedRanges.length,
					"Contractor availability loaded",
					true
				);
			} catch (error) {
				if (requestId !== visibleRangeRequestRef.current) return;
				console.error("Could not load calendar allocations", error);
				setEvents([]);
				setBlockedProjects([]);
				updateLoadingProgress(
					"allocations",
					0,
					"Calendar allocations could not be loaded",
					true
				);
				updateLoadingProgress(
					"blockedAllocations",
					0,
					"Calendar allocations could not be loaded",
					true
				);
			}
		},
		[markLoadingSources, updateLoadingProgress]
	);
	useEffect(() => {
		const zohoConnect = async () => {
			ZOHO.embeddedApp.on("PageLoad", function (data) {});
			await ZOHO.embeddedApp.init();

			getAllProjectsForSearch((count) =>
				updateLoadingProgress(
					"projectCatalog",
					count,
					"Loading the complete project catalogue…"
				)
			)
				.then((allProjects) => {
					setSearchableProjects(allProjects);
					updateLoadingProgress(
						"projectCatalog",
						allProjects.length,
						"Project catalogue loaded",
						true
					);
				})
				.catch((error) => {
					console.error("Could not load the complete project catalogue", error);
					setSearchProjectsError(
						"The complete CRM project catalogue could not be loaded."
					);
					updateLoadingProgress(
						"projectCatalog",
						0,
						"Continuing without the full project catalogue",
						true
					);
				})
				.finally(() => setSearchProjectsLoading(false));

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
				searchableProjects={searchableProjects}
				searchProjectsLoading={searchProjectsLoading}
				searchProjectsError={searchProjectsError}
				loadingProgress={loadingProgress}
				onAllocationCreated={handleAllocationCreated}
				onVisibleDateRangeChange={handleVisibleDateRangeChange}
			/>
		</Box>
	);
}

export default App;
