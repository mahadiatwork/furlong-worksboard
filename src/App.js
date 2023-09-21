import { Box, Card, CircularProgress, Grid } from "@mui/material";
import { useEffect, useState } from "react";
import "./App.css";
import Calendar from "./components/Calendar";
import FurlongDemo3 from "./components/FurlongDemo/FurlongDemo3";
import InputForm from "./components/InputForm/InputForm";
import ProjectTable from "./components/ProjectTable/ProjectTable";
const ZOHO = window.ZOHO;
function App() {
  const [view, setView] = useState("month");
  const [projects, setProjects] = useState([]);
  const [painters, setPainters] = useState([]);
  const [zohoLoaded, setZohoLoaded] = useState(false);
  const [events, setEvents] = useState([]);
  const [reload, setReload] = useState(false);
  const [inProgress,setInProgress] = useState([])

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
          "select Name,Project_Timing,id,Work_Summary_Sale,Account_name,Budget_time_Add_Remove from FP_Projects where ((((Project_Status = 'Requested') or (Project_Status != 'In Progress'))or(Project_Status = 'Rectification'))and(Job_Offer_Status = 'Not Allocated'))",
      };
      const projectsResp = await ZOHO.CRM.API.coql(config).then(function (
        data
      ) {
        console.log({ data });
        setProjects(data.data);
      });

      // (project_allocation:equals:false)

      // Query: "(Contractor_Status:equals:Active)",

      const painterData = await ZOHO.CRM.API.searchRecord({
        Entity: "Contractors",
        Type: "criteria",
        Query:
          "((Contractor_Status:equals:Active)and(Employment_Type:equals:Contractor))",
      });

      const projectData = await ZOHO.CRM.API.searchRecord({
        Entity: "FP_Projects",
        Type: "criteria",
        Query:
          "((Project_Status:equals:Requested)and(Job_Offer_Status:equals:Not Allocated))",
      });

      const InProgressProjectData = await ZOHO.CRM.API.searchRecord({
        Entity: "FP_Projects",
        Type: "criteria",
        Query: "Project_Status:equals:In Progress",
      });

      setInProgress(InProgressProjectData.data)
      console.log({ InProgressProjectData });

      setPainters(painterData.data);

      const eventData = await ZOHO.CRM.API.getAllRecords({
        Entity: "Job_Allocations",
        sort_order: "asc",
        per_page: 100,
        page: 1,
      });

      let zohoEvents = [];

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
    };
    zohoConnect();
  }, []);

  console.log({ events });

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
    <Box sx={{ height: "100vh",overflowY: "hidden"}}>
      {/* <Grid container>
        <Grid item lg={7} md={12} xs={12}>
          <Card sx={{ p: 3, height: "95vh" }}>
            <Calendar contractors={painters} events={events} />
          </Card>
        </Grid>
        <Grid item lg={5} md={12} xs={12}>
          <Card sx={{ ml: 2, height: "95vh" }}>
            <ProjectTable
              projects={projects}
              painters={painters}
              setFormSubmitted={setFormSubmitted}
              setReload={setReload}
            />
          </Card>
        </Grid>
      </Grid> */}

      <Calendar contractors={painters} events={events} projects={projects} inProgress={inProgress} />

      {/* <ProjectTable
              projects={projects}
              painters={painters}
              setFormSubmitted={setFormSubmitted}
              setReload={setReload}
            /> */}
    </Box>
  );
}

export default App;
