import {
	Box,
	Card,
	CircularProgress,
	Grid,
	LinearProgress,
	Typography,
} from "@mui/material";
import { useCallback, useEffect, useState } from "react";
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

async function getAllJobAllocations(onProgress = () => {}) {
	const allocations = [];
	let page = 1;
	let moreRecords = true;

	while (moreRecords) {
		const response = await ZOHO.CRM.API.getAllRecords({
			Entity: "Job_Allocations",
			sort_order: "asc",
			per_page: 200,
			page,
		});
		const pageRecords = response?.data || [];
		allocations.push(...pageRecords);
		onProgress(allocations.length);
		moreRecords = Boolean(response?.info?.more_records) && pageRecords.length > 0;
		page += 1;
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
	const [view, setView] = useState("month");
	const [projects, setProjects] = useState([]);
	const [painters, setPainters] = useState([]);
	const [zohoLoaded, setZohoLoaded] = useState(false);
	const [events, setEvents] = useState([]);
	const [inProgress, setInProgress] = useState([]);
	const [blockedProjects, setBlockedProjects] = useState([]);
	const [fetchDataLoading, setFetchDataLoading] = useState(true);
	const [rectification, setRectification] = useState([])
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

	//form submitted handler for input form
	const setFormSubmitted = () => {
		window.location.reload();
	};
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
	useEffect(() => {
		const zohoConnect = async () => {
			ZOHO.embeddedApp.on("PageLoad", function (data) {});
			const zohoLoaded = await ZOHO.embeddedApp
				.init()
				.then(() => setZohoLoaded(true));

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
					"select Name,Project_Timing,id,Work_Summary_Sale,Account_name,Budget_time_Add_Remove,Project_Status from FP_Projects where ((((Project_Status = 'Requested') or (Project_Status != 'In Progress'))or(Project_Status = 'Rectification'))and(Job_Offer_Status = 'Not Allocated'))",
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
				console.log({ sortedData });
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

			setRectification(rectificationData.data)
			updateLoadingProgress(
				"rectificationProjects",
				rectificationData?.data?.length || 0,
				"Rectification projects loaded",
				true
			);

			setPainters(painterData.data);

			const orgVarResp = await getZohoOrgVariable("worksboard_org_var");
			setContractorOrder(parseContractorOrder(extractOrgVariableValue(orgVarResp)));

			const eventData = await getAllJobAllocations((count) =>
				updateLoadingProgress(
					"allocations",
					count,
					"Loading calendar allocations…"
				)
			);
			updateLoadingProgress(
				"allocations",
				eventData.length,
				"Calendar allocations loaded",
				true
			);

			const blockedProjectsTemp = await ZOHO.CRM.API.searchRecord({
				Entity: "Job_Allocations",
				Type: "criteria",
				Query: "Type:equals:Blocked",
			});

			let test = blockedProjectsTemp?.data?.map((el, index) => {
				let data = {
					resource: el?.Contractor?.id,
					start: el?.Start_Date,
					end: el?.End_Date,
				};
				return data;
			});

			console.log({test});

			setBlockedProjects(test);
			updateLoadingProgress(
				"blockedAllocations",
				test?.length || 0,
				"Contractor availability loaded",
				true
			);

			let zohoEvents = [];

			// const start_time=blockedProjects[0].Start_Date
			// const end_time = blockedProjects[0].End_Date
			// const id =blockedProjects[0].Contractor.id

			// config = {
			//   select_query:
			//     "select Projects,Contractor,Start_Date,End_Date,Color_Code from Job_Allocations where Name	is not null",
			// };
			// const eventResp = await ZOHO.CRM.API.coql(config).then(function (data) {
			//   if(data.data.length > 0){
			//     setEvents(data.data);
			//   }
			// });

			eventData.forEach((event) => {
				zohoEvents.push(event);
			});
			setEvents(zohoEvents);
			setFetchDataLoading(false);
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
			{/* {!fetchDataLoading ? (
				<Calendar
					contractors={painters}
					events={events}
					projects={projects}
					inProgress={inProgress}
					blockedProjects={blockedProjects}
				/>
			) : (
				<Typography>Loading...</Typography>
			)} */}
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
				/>
		</Box>
	);
}

export default App;
