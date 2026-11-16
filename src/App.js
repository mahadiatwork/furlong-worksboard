import {
	Box,
	CircularProgress,
	LinearProgress,
	Typography,
} from "@mui/material";
import { useCallback, useEffect, useRef, useState } from "react";
import {
	createAllocationLoader,
	fetchJobAllocations,
	toBlockedRanges,
} from "./allocations";
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
	// Allocations fetched so far (by id) and the months already loaded
	// successfully, so navigating back to a visited month never refetches.
	const allocationLoaderRef = useRef(
		createAllocationLoader((start, end, onProgress) =>
			fetchJobAllocations(ZOHO, start, end, onProgress)
		)
	);
	const pendingRangeRequestsRef = useRef(0);
	const lastRequestedRangeRef = useRef(null);
	const [allocationsError, setAllocationsError] = useState("");

	const syncEventsFromCache = useCallback(() => {
		const all = allocationLoaderRef.current.getAll();
		setEvents(all);
		setBlockedProjects(toBlockedRanges(all));
	}, []);

	const handleAllocationCreated = useCallback(
		(allocation) => {
			if (!allocation?.id) return;
			allocationLoaderRef.current.add(allocation);
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
			lastRequestedRangeRef.current = { start, end };

			const label = `Loading calendar allocations for ${start} to ${end}…`;
			markLoadingSources(["allocations", "blockedAllocations"], label);
			pendingRangeRequestsRef.current += 1;
			try {
				const { fetched } = await allocationLoaderRef.current.load(
					start,
					end,
					(count) =>
						updateLoadingProgress(
							"allocations",
							allocationLoaderRef.current.getAll().length + count,
							label
						)
				);
				setAllocationsError("");
				if (fetched) syncEventsFromCache();
			} catch (error) {
				console.error("Could not load calendar allocations", error);
				setAllocationsError(
					error?.message || "Calendar allocations could not be loaded."
				);
				syncEventsFromCache();
			} finally {
				pendingRangeRequestsRef.current -= 1;
				if (pendingRangeRequestsRef.current === 0) {
					const cached = allocationLoaderRef.current.getAll();
					updateLoadingProgress(
						"allocations",
						cached.length,
						"Calendar allocations loaded",
						true
					);
					updateLoadingProgress(
						"blockedAllocations",
						toBlockedRanges(cached).length,
						"Contractor availability loaded",
						true
					);
				}
			}
		},
		[markLoadingSources, updateLoadingProgress, syncEventsFromCache]
	);
	const retryAllocations = useCallback(() => {
		if (lastRequestedRangeRef.current) {
			handleVisibleDateRangeChange(lastRequestedRangeRef.current);
		}
	}, [handleVisibleDateRangeChange]);
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
				allocationsError={allocationsError}
				onRetryAllocations={retryAllocations}
			/>
		</Box>
	);
}

export default App;
