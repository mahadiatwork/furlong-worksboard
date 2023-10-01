import React, { useEffect, useState } from "react";
import "@mobiscroll/react/dist/css/mobiscroll.min.css";
import { Eventcalendar, Draggable, toast, Popup } from "@mobiscroll/react";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Card,
  Grid,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import moment from "moment";
import CloseIcon from "@mui/icons-material/Close";
import { DatePicker, LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterMoment } from "@mui/x-date-pickers/AdapterMoment";
import { handleDelete, handleUpdate, sortDates } from "./helpingFunctions";
import dayjs from "dayjs";
import ExcludeDates from "./ExcludeDates";

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
  const [start__Date, setStartDate] = useState(null);
  const [end__Date, setEndDate] = useState(null);
  const [excluded, setExcluded] = useState(null);
  const [eventSelected, setEventSelected] = useState(false);
  // const [myEvents, setMyEvents] = useState([])
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
        // console.log(event.Projects.name, event.Start_Date, event.End_Date)
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
          Excluded_Dates: event.Excluded_Dates,
        });
      }
    });
  }

  let myEventsWithExclusions = [];

  myEvents.forEach((event) => {
    if (event.Excluded_Dates) {
      const excludedDates = event.Excluded_Dates.split(",").map((dateStr) => {
        return moment(dateStr, "YYYY-MM-DD").format("YYYY-MM-DD"); // Parse the excluded dates using the specified format
      });

      const sortedDates = sortDates(excludedDates);

      console.log({ sortedDates });

      let startDate = moment(event.start);
      const endDate = moment(event.end);

      // Initialize an array to store the dates
      const datePairs = [];

      let currentPair = null;

      for (
        let date = startDate.clone();
        date.isSameOrBefore(endDate);
        date.add(1, "days")
      ) {
        const formattedDate = date.format("YYYY-MM-DD");

        if (excludedDates.includes(formattedDate)) {
          if (currentPair) {
            datePairs.push(currentPair);
            currentPair = null;
          }
        } else {
          if (!currentPair) {
            currentPair = {
              start: formattedDate,
              end: event.end,
              title: event.title,
              resource: event?.resource,
              event_id: event?.event_id,
              color: event.color,
              project_id: event?.project_id,
              Project_Summary: event.Project_Summary,
              estimated_time_budget: event.estimated_time_budget,
              Excluded_Dates: event.Excluded_Dates,
            };
          } else {
            currentPair.end = formattedDate;
          }
        }
      }

      if (currentPair) {
        datePairs.push(currentPair);
      }

      // Remove empty objects
      const filteredDatePairs = datePairs.filter((pair) => pair !== null);

      myEventsWithExclusions = [
        ...myEventsWithExclusions,
        ...filteredDatePairs,
      ];
    } else {
      myEventsWithExclusions.push(event);
    }
  });

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

  function createTask(project, color) {
    return {
      title: project.Account_name,
      color,
      project_id: project.id,
      work_summary: project.Work_Summary_Sale,
      estimated_time_budget: project.Budget_time_Add_Remove,
      Project_Timing: project.Project_Timing,
    };
  }

  const timingToTasksMap = {
    Urgent: urgent,
    "As soon as possible": as_soon_as_possible,
    "Term 1 School holidays": term_1_holiday,
    "Term 2 School holidays": term_2_holiday,
    "Term 3 School holidays": term_3_holiday,
    "Term 4 School holidays": term_4_holiday,
    "Specific dates provided": specific_dates_provided,
    "Weekend works": weekend_works,
  };

  if (projects.length > 0) {
    projects.forEach((project) => {
      const projectTiming = project.Project_Timing;
      if (timingToTasksMap.hasOwnProperty(projectTiming)) {
        const task = createTask(project, "gray");
        timingToTasksMap[projectTiming].push(task);
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
      activeProjects.push(createTask(project, "#C4F0B3"));
    });
  }

  const onEventUpdated = React.useCallback(async (args) => {
    // here you can update the event in your storage as well, after drag & drop or resize
    const changedEvent = args.event;
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

  // define the custom sorting function

  const sortedArray = desiredOrder.map((name) =>
    myResources.find((obj) => obj.name === name)
  );

  const unsortedArray = myResources.filter(
    (item) => !desiredOrder.includes(item.name)
  );

  const sortedResources = [...sortedArray, ...unsortedArray];

  const [isOpen, setOpen] = React.useState(false);
  const [anchor, setAnchor] = React.useState(null);
  const timerRef = React.useRef(null);
  const [popupdata, setPopupData] = React.useState(null);

  const onEventHoverIn = React.useCallback(
    (args) => {
      setEventSelected(true);
      let tempEvent = args.event;

      console.log({ tempEvent: tempEvent, myEvents: myEvents, events: events });

      const foundevent = myEvents.filter(
        (event) => event.event_id === tempEvent.event_id
      )[0];

      console.log({ foundevent });

      if (foundevent !== undefined) {
        // const result = activeProjects.find(
        //   (project) => foundevent.project_id === project.project_id);
        console.log("un");
        setStartDate(moment(foundevent?.start));
        setEndDate(moment(foundevent?.end));
        setPopupData(foundevent);
      }

      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      setAnchor(args.domEvent.target);
      setOpen(true);
    },
    [myEvents]
  );

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

  //Excluded days looping
  let days = [];

  function dateRange(startDate, endDate, steps = 1) {
    const dateArray = [];
    const start = moment(startDate);
    const end = moment(endDate);
    const currentDate = start.clone();

    // console.log(startDate, endDate);

    while (currentDate.isSameOrBefore(end)) {
      dateArray.push(currentDate.format("YYYY-MM-DD"));
      currentDate.add(1, "days");
    }
    return dateArray;
  }

  start__Date !== null &&
    end__Date !== null &&
    (days = dateRange(start__Date, end__Date));

  return (
    <Box sx={{ height: "100vh", overflowY: "hidden", bgcolor: "#f8f8f8" }}>
      <Grid container>
        <Grid xs={9} sx={{ padding: "10px" }}>
          <Eventcalendar
            themeVariant="light"
            view={view}
            invalid={myInvalids}
            data={myEventsWithExclusions}
            resources={myResources}
            // dragToMove={true}
            externalDrop={true}
            eventOverlap={false}
            onEventCreate={onEventCreate}
            // dragToResize={true}
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
          {eventSelected && (
            <Box sx={{ padding: "10px" }}>
              <Box sx={{ display: "flex", justifyContent: "space-around" }}>
                <Typography
                  variant="h5"
                  align="center"
                  sx={{ padding: "20px 0px", fontWeight: "bold" }}
                >
                  Update Allocated Project
                </Typography>
                <Button onClick={() => setEventSelected(false)}> Cancel</Button>
              </Box>
              <Box sx={{ display: "flex" }}>
                <p className="input-label">Event Name: </p>
                <p>{popupdata.title}</p>
              </Box>
              <Box sx={{ display: "flex" }}>
                <label className="input-label">Start Date</label>
                <LocalizationProvider dateAdapter={AdapterMoment}>
                  <DatePicker
                    label="Select Start Date"
                    value={start__Date}
                    onChange={(newValue) => {
                      setStartDate(newValue);
                    }}
                    renderInput={(params) => <TextField {...params} />}
                  />
                </LocalizationProvider>
              </Box>
              <br />
              <Box sx={{ display: "flex" }}>
                <label className="input-label">End Date</label>
                <LocalizationProvider dateAdapter={AdapterMoment}>
                  <DatePicker
                    label="Select End Date"
                    value={end__Date}
                    onChange={(newValue) => {
                      setEndDate(newValue);
                    }}
                    renderInput={(params) => <TextField {...params} />}
                  />
                </LocalizationProvider>
              </Box>
              <br />
              <br />
              <ExcludeDates days={days} setExcluded={setExcluded} />
              <br />
              <br />
              <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                <Button
                  variant="contained"
                  onClick={() =>
                    handleUpdate(
                      start__Date,
                      end__Date,
                      excluded,
                      popupdata,
                      ZOHO
                    )
                  }
                >
                  Update Allocation
                </Button>
                <Button
                  variant="contained"
                  color="error"
                  onClick={() => handleDelete(popupdata, ZOHO)}
                >
                  Delete
                </Button>
              </Box>
            </Box>
          )}
          {!eventSelected && (
            <Box sx={{ padding: "10px 0px" }}>
              <Typography
                variant="h5"
                align="center"
                sx={{ padding: "20px 0px" }}
              >
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
          )}
          {!eventSelected && (
            <div>
              <Typography
                sx={{ margin: "10px 0px" }}
                align="center"
                variant="h5"
              >
                In Progress
              </Typography>
              <div>
                {activeProjects.map((task, i) => (
                  <Task key={i} data={task} />
                ))}
              </div>
            </div>
          )}
        </Grid>
      </Grid>
      {/* <div style={{ display: "flex", height: "95vh" }}>
        <Popup
          // display="anchored"
          isOpen={isOpen}
          anchor={anchor}
          touchUi={false}
          showOverlay={false}
          contentPadding={false}
          closeOnOverlayClick={false}
          width={600}
          cssClass="md-tooltip"
        >
          <Card onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
            <div className="md-tooltip-info">
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <CloseIcon
                  sx={{ cursor: "pointer" }}
                  onClick={() => setOpen(false)}
                />
              </div>
              <Box sx={{ display: "flex" }}>
                <label className="input-label">Start Date</label>
                <LocalizationProvider dateAdapter={AdapterMoment}>
                  <DatePicker
                    label="Select Start Date"
                    value={start__Date}
                    onChange={(newValue) => {
                      setStartDate(newValue);
                    }}
                    renderInput={(params) => <TextField {...params} />}
                  />
                </LocalizationProvider>
              </Box>
              <br />
              <Box sx={{ display: "flex" }}>
                <label className="input-label">End Date</label>
                <LocalizationProvider dateAdapter={AdapterMoment}>
                  <DatePicker
                    label="Select End Date"
                    value={end__Date}
                    onChange={(newValue) => {
                      setEndDate(newValue);
                    }}
                    renderInput={(params) => <TextField {...params} />}
                  />
                </LocalizationProvider>
              </Box>
              <br />
              <ExcludeDates days={days} setExcluded={setExcluded} />
              <br />
              <br />
            </div>
          </Card>
        </Popup>
      </div> */}
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
