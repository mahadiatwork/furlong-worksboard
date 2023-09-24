import React, { useEffect, useState } from "react";
import "@mobiscroll/react/dist/css/mobiscroll.min.css";
import {
  Eventcalendar,
  Draggable,
  setOptions,
  getJson,
  toast,
  Popup,
} from "@mobiscroll/react";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Grid,
  Tooltip,
  Typography,
} from "@mui/material";
import moment from "moment";
import CloseIcon from "@mui/icons-material/Close";

const ZOHO = window.ZOHO;

// Create a TaskAccordion component
function TaskAccordion({ tasks, title }) {
  return (
    tasks.length > 0 && (
      <Accordion>
        <AccordionSummary
          expandIcon={<ExpandMoreIcon />}
          aria-controls="panel1a-content"
          id="panel1a-header"
        >
          <Typography>{title}</Typography>
        </AccordionSummary>
        <AccordionDetails>
          {tasks.map((task, i) => (
            <Task key={i} data={task} />
          ))}
        </AccordionDetails>
      </Accordion>
    )
  );
}

function Calendar({ contractors, events, projects, inProgress }) {
  const view = React.useMemo(() => {
    return {
      timeline: {
        type: "month",
        rowHeight: "equal",
        eventCreation: "false",
      },
    };
  }, []);

  const myResources = [];
  const myEvents = [];
  const tasks = [];

  if (contractors.length > 0) {
    contractors.forEach((contractor) => {
      myResources.push({
        id: contractor?.id,
        name: contractor.First_Name + " " + contractor.Last_Name,
        // test: "test"
      });
    });
  }

  if (events.length > 0) {
    events.forEach((event) => {
      if (event.Projects !== null) {
        myEvents.push({
          start: event.Start_Date,
          end: event.End_Date,
          title: event.Projects.name,
          resource: event?.Contractor?.id,
          event_id: event?.id,
          color: event.Color_Code,
          project_id: event?.Projects?.id,
          Project_Summary: event.Project_Summary,
          estimated_time_budget: event.Current_Estimated_Time_Budget,
        });
      }
    });
  }

  const onEventCreate = React.useCallback(async (event) => {
    const recordData = {
      Start_Date: moment(event.event.start.toString()).format("YYYY-MM-DD"),
      End_Date: moment(event.event.end.toString()).format("YYYY-MM-DD"),
      Projects: { id: event.event.project_id },
      Contractor: { id: event.event.resource },
      Project_Name: event.event.title,
    };

    await ZOHO.CRM.API.insertRecord({
      Entity: "Job_Allocations",
      APIData: recordData,
      Trigger: ["workflow"],
    }).then(function (data) {
      if (data.data[0].status === "success") {
        toast({
          message: "Project Allocated Successfully",
        });
        const config = {
          Entity: "FP_Projects",
          APIData: {
            id: event.event.project_id,
            Job_Offer_Status: "Allocated",
          },
          Trigger: ["workflow"],
        };
        ZOHO.CRM.API.updateRecord(config).then(function (data) {
          console.log(data);
        });
        window.location.reload(false);
      } else {
        toast({
          message: "There is something wrong",
        });
      }
    });
  }, []);

  const now = new Date();

  const activeProjects = [];

  const as_soon_as_possible = [];
  const urgent = [];
  const term_1_holiday = [];
  const term_2_holiday = [];
  const term_3_holiday = [];
  const term_4_holiday = [];
  const specific_dates_provided = [];
  const weekend_works = [];

  if (projects.length > 0) {
    projects.forEach((project) => {
      let task = {
        title: project.Account_name,
        color: "gray",
        // color:
        //   project.Project_Timing === "Urgent"
        //     ? "#eb4d4d"
        //     : project.Project_Timing === "As soon as possible"
        //     ? "#90A9FD"
        //     : project.Project_Timing === "Term 1 School holidays"
        //     ? "#C4F0B3"
        //     : project.Project_Timing === "Term 2 School holidays"
        //     ? "#98D681"
        //     : project.Project_Timing === "Term 3 School holidays"
        //     ? "#67C480"
        //     : project.Project_Timing === "Term 4 School holidays"
        //     ? "#8A37BE"
        //     : project.Project_Timing === "Specific dates provided"
        //     ? "#ACACAC"
        //     : project.Project_Timing === "Weekend works"
        //     ? "#FFDA62"
        //     : "salmon",
        project_id: project.id,
        work_summary: project.Work_Summary_Sale,
        estimated_time_budget: project.Budget_time_Add_Remove,
        Project_Timing: project.Project_Timing,
      };
      if (project.Project_Timing === "Urgent") {
        urgent.push(task);
      }
      if (project.Project_Timing === "As soon as possible") {
        as_soon_as_possible.push(task);
      }
      if (project.Project_Timing === "Term 1 School holidays") {
        term_1_holiday.push(task);
      }
      if (project.Project_Timing === "Term 2 School holidays") {
        term_2_holiday.push(task);
      }
      if (project.Project_Timing === "Term 3 School holidays") {
        term_3_holiday.push(task);
      }
      if (project.Project_Timing === "Term 4 School holidays") {
        term_4_holiday.push(task);
      }
      if (project.Project_Timing === "Specific dates provided") {
        specific_dates_provided.push(task);
      }
      if (project.Project_Timing === "Weekend works") {
        weekend_works.push(task);
      }
    });
  }

  const taskTypes = [
    { tasks: urgent, title: "Urgent" },
    { tasks: as_soon_as_possible, title: "As soon as possible" },
    { tasks: term_1_holiday, title: "Term 1 Holiday" },
    { tasks: term_2_holiday, title: "Term 2 Holiday" },
    { tasks: term_3_holiday, title: "Term 3 Holiday" },
    { tasks: term_4_holiday, title: "Term 4 Holiday" },
    { tasks: specific_dates_provided, title: "Specific Dates Provided" },
    { tasks: weekend_works, title: "Weekend Works" },
  ];

  if (inProgress.length > 0) {
    inProgress.forEach((project) => {
      activeProjects.push({
        title: project.Account_name,
        color: "#C4F0B3",
        // color:
        //   project.Project_Timing === "Urgent"
        //     ? "#eb4d4d"
        //     : project.Project_Timing === "As soon as possible"
        //     ? "#90A9FD"
        //     : project.Project_Timing === "Term 1 School holidays"
        //     ? "#C4F0B3"
        //     : project.Project_Timing === "Term 2 School holidays"
        //     ? "#98D681"
        //     : project.Project_Timing === "Term 3 School holidays"
        //     ? "#67C480"
        //     : project.Project_Timing === "Term 4 School holidays"
        //     ? "#8A37BE"
        //     : project.Project_Timing === "Specific dates provided"
        //     ? "#ACACAC"
        //     : project.Project_Timing === "Weekend works"
        //     ? "#FFDA62"
        //     : "salmon",
        project_id: project.id,
        work_summary: project.Work_Summary_Sale,
        estimated_time_budget: project.Budget_time_Add_Remove,
        Project_Timing: project.Project_Timing,
      });
    });
  }

  const onEventUpdated = React.useCallback((args) => {
    // here you can update the event in your storage as well, after drag & drop or resize
    const changedEvent = args.event;

    console.log({ changedEvent });

    var config = {
      Entity: "Job_Allocations",
      APIData: {
        id: changedEvent.event_id,
        Start_Date: moment(changedEvent.start.toString()).format("YYYY-MM-DD"),
        End_Date: moment(changedEvent.end.toString()).format("YYYY-MM-DD"),
        Contractor: { id: changedEvent.resource },
      },
      Trigger: ["workflow"],
    };
    ZOHO.CRM.API.updateRecord(config).then(function (data) {
      if (data.data[0].status === "success") {
        toast({
          message: "Project Allocation Updated Successfully",
        });
      } else {
        toast({
          message: "There is something wrong",
        });
      }
    });

    // ...
  }, []);

  const myInvalids = React.useMemo(() => {
    return [
      {
        recurring: {
          repeat: "weekly",
          weekDays: "SA,SU",
        },
      },
    ];
  }, []);

  const desiredOrder = [
    "Donny Georgopoulos",
    "Troy Kennedy",
    "Christine Rogers",
    "William Hunter",
    "John Eghdame",
    "Farhad Baleshzar",
    "Michael Icaro",
    "Muhummad Ashraf",
    "Keith Higgins",
    "Jobanpreet Singh",
    "Andy Joseph",
    "Parimal Patel",
  ];

  console.log({ myResources });

  // define the custom sorting function

  const sortedArray = desiredOrder.map((name) =>
    myResources.find((obj) => obj.name === name)
  );

  const unsortedArray = myResources.filter(
    (item) => !desiredOrder.includes(item.name)
  );

  const sortedResources = [...sortedArray, ...unsortedArray];

  // useEffect(() => {
  //   sortedResources.map((item) => {
  //     item["eventCreation"] = false;
  //   })
  // },[])

  const [isOpen, setOpen] = React.useState(false);
  const [anchor, setAnchor] = React.useState(null);
  const [currentEvent, setCurrentEvent] = React.useState(null);
  const [info, setInfo] = React.useState("");
  const [time, setTime] = React.useState("");
  const [status, setStatus] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [location, setLocation] = React.useState("");
  const [buttonText, setButtonText] = React.useState("");
  const [buttonType, setButtonType] = React.useState("");
  const [bgColor, setBgColor] = React.useState("");
  const timerRef = React.useRef(null);
  const [isToastOpen, setToastOpen] = React.useState(false);
  const [toastText, setToastText] = React.useState();
  const [popupdata, setPopupData] = React.useState(null);

  const onEventHoverIn = React.useCallback((args) => {
    const event = args.event;

    // const result = projects.find((project) => event.project_id === project.id);
    setPopupData({
      summary: event.Project_Summary,
      title: event.title.split("-")[1],
      popupColor: event.color,
    });

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    setAnchor(args.domEvent.target);
    setOpen(true);
  }, []);

  const onEventHoverOut = React.useCallback(() => {
    timerRef.current = setTimeout(() => {
      setOpen(false);
    }, 200);
  }, []);

  const onMouseEnter = React.useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
  }, []);

  const onMouseLeave = React.useCallback(() => {
    timerRef.current = setTimeout(() => {
      setOpen(false);
    }, 200);
  }, []);

  return (
    <Box sx={{ height: "100vh", overflowY: "hidden", bgcolor: "#f8f8f8" }}>
      <Grid container>
        <Grid xs={9} sx={{ padding: "10px" }}>
          <Eventcalendar
            themeVariant="light"
            view={view}
            // invalid={myInvalids}
            data={myEvents}
            resources={myResources}
            dragToMove={true}
            externalDrop={true}
            onEventCreate={onEventCreate}
            dragToResize={true}
            onEventUpdated={onEventUpdated}
            clickToCreate={false}
            dragToCreate={false}
            showEventTooltip={false}
            // onEventHoverIn={onEventHoverIn}
            onEventClick={onEventHoverIn}
            // onEventHoverOut={onEventHoverOut}
          />
        </Grid>
        <Grid
          xs={3}
          sx={{
            height: "100vh",
            overflowY: "scroll",
          }}
        >
          <Box sx={{padding: "10px 0px"}}>
            <Typography variant="h5" align="center" sx={{padding:"20px 0px"}}>
              Available Projects
            </Typography>
            {taskTypes.map((taskType, index) => (
              <TaskAccordion
                key={index}
                tasks={taskType.tasks}
                title={taskType.title}
              />
            ))}
          </Box>
          <div>
            <Typography sx={{ margin: "10px 0px" }} align="center" variant="h5">
              In Progress
            </Typography>
            <div>
              {activeProjects.map((task, i) => (
                <Task key={i} data={task} />
              ))}
            </div>
          </div>
        </Grid>
      </Grid>
      <div style={{ display: "flex", height: "95vh" }}>
        <Popup
          // display="anchored"
          isOpen={isOpen}
          anchor={anchor}
          touchUi={false}
          showOverlay={false}
          contentPadding={false}
          closeOnOverlayClick={false}
          width={350}
          cssClass="md-tooltip"
        >
          <div
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
            style={{
              backgroundColor: `${
                popupdata === null ? "#313949" : popupdata?.popupColor
              }`,
            }}
          >
            <div className="md-tooltip-info">
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <CloseIcon
                  sx={{ cursor: "pointer" }}
                  onClick={() => setOpen(false)}
                />
              </div>
              <div className="md-tooltip-title">
                Project Name: {popupdata?.title}
              </div>
              <div className="md-tooltip-title">
                Project Summary: {popupdata?.summary}
              </div>
              <div className="md-tooltip-title">
                Current Estimated Time Budget: test {240}
              </div>
            </div>
          </div>
        </Popup>
      </div>
    </Box>
  );
}

export default Calendar;

function Task(props) {
  const [draggable, setDraggable] = React.useState();

  const setDragElm = React.useCallback((elm) => {
    setDraggable(elm);
  }, []);

  return (
    <div
      ref={setDragElm}
      style={{ background: props.data.color }}
      className="external-event-task"
    >
      {/* <div className="container">
        <Tooltip title={props.data.work_summary} arrow>
          <div className="first-div"></div>
        </Tooltip>
        <div className="second-div"></div>
      </div> */}
      <Tooltip title={`${props.data.work_summary}`} placement="left-start">
        <Button
          sx={{
            textTransform: "none",
            padding: 0,
            color: "#000",
          }}
        >
          {props.data.title +
            ": CET - " +
            `${props.data.estimated_time_budget || "(n/a)"}`}
        </Button>
      </Tooltip>
      <Draggable dragData={props.data} element={draggable} />
    </div>
  );
}
