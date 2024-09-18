import { Box, Card, CircularProgress, Grid, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import "./App.css";
import Calendar from "./components/Calendar";
const ZOHO = window.ZOHO;
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

	//form submitted handler for input form
	const setFormSubmitted = () => {
		window.location.reload();
	};
	useEffect(() => {
		const zohoConnect = async () => {
			ZOHO.embeddedApp.on("PageLoad", function (data) {});
			const zohoLoaded = await ZOHO.embeddedApp
				.init()
				.then(() => setZohoLoaded(true));

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
			});

			// (project_allocation:equals:false)

			// Query: "(Contractor_Status:equals:Active)",

			const painterData = await ZOHO.CRM.API.searchRecord({
				Entity: "Contractors",
				Type: "criteria",
				Query:
					"((Contractor_Status:equals:Active)and(Employment_Type:equals:Contractor))",
			});

			const InProgressProjectData = await ZOHO.CRM.API.searchRecord({
				Entity: "FP_Projects",
				Type: "criteria",
				Query: "Project_Status:equals:In Progress",
			});

			setInProgress(InProgressProjectData.data);

			const rectificationData = await ZOHO.CRM.API.searchRecord({
				Entity: "FP_Projects",
				Type: "criteria",
				Query: "Project_Status:equals:Rectification",
			});

			setRectification(rectificationData.data)

			setPainters(painterData.data);

			const eventData = await ZOHO.CRM.API.getAllRecords({
				Entity: "Job_Allocations",
				sort_order: "asc",
				per_page: 100,
				page: 1,
			});

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

			eventData.data.forEach((event) => {
				zohoEvents.push(event);
			});
			setEvents(zohoEvents);
			setFetchDataLoading(false);
		};
		zohoConnect();
	}, []);
	

	if (painters.length === 0) {
		return (
			<Box
				sx={{
					height: "100vh",
					width: "100%",
					display: "flex",
					justifyContent: "center",
					alignItems: "center",
				}}
			>
				<CircularProgress />
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
					events={events}
					projects={projects}
					inProgress={inProgress}
					blockedProjects={blockedProjects}
					rectification={rectification}
				/>
		</Box>
	);
}

export default App;
