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
  IconButton,
  List,
  ListItem,
  ListItemText,
  Modal,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import moment from "moment";
import CloseIcon from "@mui/icons-material/Close";
import SettingsIcon from "@mui/icons-material/Settings";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import { DatePicker, LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterMoment } from "@mui/x-date-pickers/AdapterMoment";
import { handleAccept, handleDelete, handleUpdate, sortDates } from "./helpingFunctions";
import dayjs from "dayjs";
import ExcludeDates from "./ExcludeDates";
import DeleteDialog from "./DeleteDialog";
import { useMemo } from "react";
import { CallMissedOutgoing } from "@mui/icons-material";
import ViewToggle from "./ViewToggle";

const ZOHO = window.ZOHO;
const PROJECT_CRM_URL =
  "https://crm.zoho.com/crm/org465508368/tab/CustomModule23";
const PROJECT_CRM_PAGE_ID = "1915689000165817581";

function getProjectCrmUrl(projectId) {
  return projectId
    ? `${PROJECT_CRM_URL}/${projectId}/page/${PROJECT_CRM_PAGE_ID}`
    : "";
}

const modernStyle = {
  position: "absolute",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  width: "400px",
  bgcolor: "background.paper",
  boxShadow: 24,
  borderRadius: "10px",
  p: 4,
  display: "flex",
  flexDirection: "column",
  gap: 2,
};

// Create a TaskAccordion component
function TaskAccordion({ tasks, title }) {
  const sortedTasks = [...tasks].sort((a, b) =>
    a.displayName.localeCompare(b.displayName)
  );

  return (
    tasks.length > 0 && (
      <Accordion disableGutters elevation={0} className="project-accordion">
        <AccordionSummary
          expandIcon={<ExpandMoreIcon />}
          aria-controls="panel1a-content"
          id="panel1a-header"
          className="project-accordion__summary"
        >
          <Typography className="project-accordion__title">{title}</Typography>
          <span className="project-count">{tasks.length}</span>
        </AccordionSummary>
        <AccordionDetails className="project-accordion__details">
          {sortedTasks.map((task) => (
            <Task key={task.project_id} data={task} />
          ))}
        </AccordionDetails>
      </Accordion>
    )
  );
}
const style = {
  position: "absolute",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  width: 400,
  bgcolor: "background.paper",
  border: "2px solid #000",
  boxShadow: 24,
  p: 4,
};

function Calendar({
  contractors,
  contractorOrder = [],
  events,
  projects,
  inProgress,
  blockedProjects,
  rectification,
  onAllocationCreated,
}) {
  const [start__Date, setStartDate] = useState(null);
  const [end__Date, setEndDate] = useState(null);
  const [excluded, setExcluded] = useState([]);
  const [eventSelected, setEventSelected] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [invalidStartDate, setInvalidStartDate] = useState("");
  const [invalidEndDate, setInvalidEndDate] = useState("");
  const [resource, setResources] = useState("");
  const [view, setView] = useState("month");
  // const [myEvents, setMyEvents] = useState([])
  // console.log({ blockedProjects });

  const [orderModalOpen, setOrderModalOpen] = useState(false);
  const [draftOrder, setDraftOrder] = useState([]);
  const [savingOrder, setSavingOrder] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const contractorFullName = (c) =>
    `${c.First_Name || ""} ${c.Last_Name || ""}`.trim();

  const activeContractorNames = useMemo(() => {
    return contractors.map(contractorFullName);
  }, [contractors]);

  const openOrderModal = () => {
    const currentNames = new Set(activeContractorNames);
    const ordered = contractorOrder.filter((name) => currentNames.has(name));
    const remaining = activeContractorNames.filter(
      (name) => !ordered.includes(name)
    );
    setDraftOrder([...ordered, ...remaining]);
    setOrderModalOpen(true);
  };

  const moveDraftItem = (index, direction) => {
    const newOrder = [...draftOrder];
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= newOrder.length) return;
    [newOrder[index], newOrder[targetIndex]] = [
      newOrder[targetIndex],
      newOrder[index],
    ];
    setDraftOrder(newOrder);
  };

  const saveContractorOrder = async () => {
    setSavingOrder(true);
    try {
      const orderJson = JSON.stringify(draftOrder);
      await ZOHO.CRM.CONNECTOR.invokeAPI("crm.set", {
        apiname: "worksboard_org_var",
        value: orderJson,
      });
      window.location.reload();
    } catch (error) {
      console.error("Failed to save contractor order", error);
      alert(
        "Could not save contractor order. Please check access to the worksboard CRM variable."
      );
      setSavingOrder(false);
    }
  };

  // const view = React.useMemo(() => {
  //   return {
  //     timeline: {
  //       type: "month",
  //       rowHeight: "equal",
  //       eventCreation: "false",
  //     },
  //   };
  // }, []);
  const myResources = [];
  const myEvents = [];
  const tasks = [];
  const track = [];
  const outsider = [];

  if (contractors.length > 0) {
    const added = new Set();
    contractorOrder.forEach((orderedName) => {
      const match = contractors.find(
        (c) => contractorFullName(c) === orderedName
      );
      if (match && !added.has(match.id)) {
        myResources.push({
          id: match.id,
          name: contractorFullName(match),
          color: accepted ? "#C4F0B3" : "blue",
        });
        added.add(match.id);
      }
    });
    contractors.forEach((name) => {
      if (!added.has(name.id)) {
        myResources.push({
          id: name?.id,
          name: contractorFullName(name),
          color: accepted ? "#C4F0B3" : "blue",
        });
        added.add(name.id);
      }
    });
  }

  if (events.length > 0) {
    events.forEach((event) => {
      if (event.Projects?.id) {
        console.log({ event });
        myEvents.push({
          start: event.Start_Date,
          end: moment(event.End_Date).format("YYYY-MM-DD"),
          title: event.Projects.name || "",
          resource: event?.Contractor?.id,
          event_id: event?.id,
          color: event.Color_Code,
          project_id: event?.Projects?.id,
          Project_Summary: event.Project_Summary || event.Scope_Of_Work || "",
          estimated_time_budget: event.Current_Estimated_Time_Budget || 0,
          Excluded_Dates: event.Excluded_Dates,
        });
      }
    });
  }

  let myEventsWithExclusions = [];

  /* ------------------ Fahims Task --------------- */
  const onEventCreate = React.useCallback(async (event) => {
    try {
      const start_date = moment(event.event.start.toString()).format(
        "YYYY-MM-DD"
      );
      const end_date = moment(event.event.end.toString()).format("YYYY-MM-DD");
      const isBlocked = event?.event?.title === "Blocked Project";

      // Fetch contractor email
      const contractorResponse = await ZOHO.CRM.API.getRecord({
        Entity: "Contractors",
        approved: "both",
        RecordID: event?.event?.resource,
      });

      const contractorMail = contractorResponse?.data[0]?.Email;

      // Prepare record data
      const recordData = {
        Start_Date: start_date,
        End_Date: end_date,
        Projects: { id: event?.event?.project_id },
        Contractor: { id: event?.event?.resource },
        Project_Name: event?.event?.title,
        Color_Code: event?.event?.color,
        Type: isBlocked ? "Blocked" : "Attendance",
        Current_Estimated_Time_Budget: String(
          event?.event?.estimated_time_budget || ""
        ),
        Project_Summary: event?.event?.work_summary,
      };

      // Insert Job Allocation record
      const jobAllocationResponse = await ZOHO.CRM.API.insertRecord({
        Entity: "Job_Allocations",
        APIData: recordData,
        Trigger: ["workflow"],
      });

      const createdAllocation = jobAllocationResponse?.data?.[0];

      if (createdAllocation?.status === "success") {
        const allocationId = createdAllocation.details.id;

        onAllocationCreated?.({
          id: allocationId,
          Start_Date: start_date,
          End_Date: end_date,
          Projects: {
            id: event.event.project_id,
            name: event.event.title,
          },
          Contractor: { id: event.event.resource },
          Color_Code: event.event.color,
          Project_Summary: event.event.work_summary,
          Current_Estimated_Time_Budget:
            event.event.estimated_time_budget || 0,
          Excluded_Dates: null,
        });

        toast({ message: "Project Allocated Successfully" });

        // Prepare attendance data
        const attendanceData = {
          Name: event.event.title,
          Attendance_Confirmation: isBlocked
            ? "Contractor Unavailable"
            : "Scheduled",
          Attendance_Date: start_date,
          Project: { id: event?.event?.project_id },
          Contractor: { id: event?.event?.resource },
          Contractor_Email: contractorMail,
          Scheduling: { id: allocationId },
        };

        // Insert Attendance record
        try {
          const attendanceResponse = await ZOHO.CRM.API.insertRecord({
            Entity: "Project_Attendance",
            APIData: attendanceData,
            Trigger: ["workflow"],
          });
          if (attendanceResponse?.data?.[0]?.status !== "success") {
            throw new Error("CRM rejected the attendance record");
          }
        } catch (attendanceError) {
          console.error(
            "Allocation saved, but attendance creation failed",
            attendanceError
          );
          toast({
            message:
              "Project allocated, but its attendance record could not be created.",
          });
        }
      } else {
        toast({ message: "There is something wrong" });
      }
    } catch (error) {
      console.error("Error during event creation:", error);
      toast({ message: "An error occurred while creating the event." });
    }
  }, [onAllocationCreated]);

  const now = new Date();

  const activeProjects = [];
  const rectificationProject = [];

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
      project_id: project?.id || "",
      work_summary: project?.Work_Summary_Sale || "",
      estimated_time_budget: project?.Budget_time_Add_Remove || "",
      Project_Timing: project?.Project_Timing || "",
      Project_Status: project?.Project_Status || "",
      start: moment(now).format("YYYY-MM-DD"),
      end: moment(now).format("YYYY-MM-DD"),
      displayName: project?.Name || project?.Account_name || "Unnamed project",
      crmUrl: getProjectCrmUrl(project?.id),
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

  const notCompletedProjects = projects.filter(
    (project) => project.Project_Status?.toLowerCase() !== "completed"
  );
  const notCompletedRectification = rectification.filter(
    (project) => project.Project_Status?.toLowerCase() !== "completed"
  );
  const notCompletedInProgress = inProgress.filter(
    (project) => project.Project_Status?.toLowerCase() !== "completed"
  );

  const normalizedSearchQuery = searchQuery.trim().toLowerCase();

  const searchResults = (() => {
    if (!normalizedSearchQuery) return [];

    const allProjects = [...projects, ...rectification, ...inProgress];
    const seen = new Set();
    const matches = [];

    allProjects.forEach((project) => {
      if (!project?.id || seen.has(project.id)) return;
      if (project.Account_name === "Blocked Project") return;

      const accountName = (project.Account_name || "").toLowerCase();
      const workSummary = (project.Work_Summary_Sale || "").toLowerCase();
      const projectName = (project.Name || "").toLowerCase();

      if (
        accountName.includes(normalizedSearchQuery) ||
        workSummary.includes(normalizedSearchQuery) ||
        projectName.includes(normalizedSearchQuery)
      ) {
        seen.add(project.id);

        const status = project.Project_Status?.toLowerCase();
        let color = "#FFEB3B";
        if (status === "completed") color = "#9E9E9E";
        else if (status === "rectification") color = "red";
        else if (status === "in progress") color = "#4CAF50";

        matches.push(createTask(project, color));
      }
    });

    return matches;
  })();

  if (notCompletedProjects.length > 0) {
    notCompletedProjects.forEach((project) => {
      const projectTiming = project.Project_Timing;
      if (timingToTasksMap.hasOwnProperty(projectTiming)) {
        const task = createTask(project, "#FFEB3B");
        timingToTasksMap[projectTiming].push(task);
      }
    });
  }

  if (notCompletedRectification.length > 0) {
    notCompletedRectification.forEach((project) => {
      const task = createTask(project, "red");
      rectificationProject.push(task);
    });
  }

  console.log({ rectificationProject });

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
  const blockProject = [];

  if (notCompletedInProgress.length > 0) {
    notCompletedInProgress.forEach((project) => {
      if (project.Account_name === "Blocked Project") {
        blockProject.push(createTask(project, "#f25e5e"));
      } else {
        activeProjects.push(createTask(project, "#4CAF50"));
      }
    });
  }

  // activeProjects.push(createTask({Account_name:'Block Time'},'#f25e5e'))

  /* ------------------Fahims Task--------------- */

  const onEventUpdated = React.useCallback(async (args) => {
    // here you can update the event in your storage as well, after drag & drop or resize
    const changedEvent = args.event;
    const event_id = changedEvent.event_id;
    const start = moment(changedEvent.start.toString()).format("YYYY-MM-DD");
    const endDate = moment(changedEvent.end.toString()).format("YYYY-MM-DD");
    const date = moment(endDate); // Parse it into a Moment object
    date.subtract(1, "days");
    const end = date.format("YYYY-MM-DD");
    console.log({ args });
    console.log({ end });

    let dateArray = dateRange(start, end);
    let diffDates = dateArray[1];
    let updatedDates = dateArray[0];
    // console.log({ diffDates }, { updatedDates });

    // console.log({ event_id });

    var config = {
      Entity: "Job_Allocations",
      APIData: {
        id: changedEvent.event_id,
        Start_Date: moment(changedEvent.start.toString()).format("YYYY-MM-DD"),
        End_Date: end,
        Contractor: { id: changedEvent.resource },
      },
      Trigger: ["workflow"],
    };

    if (
      args.event.resource != args.oldEvent.resource ||
      args.event.start != args.oldEvent.start
    ) {
      var new_config = {
        Entity: "Job_Allocations",
        APIData: {
          id: changedEvent.event_id,
          Start_Date: moment(args.event.start.toString()).format("YYYY-MM-DD"),
          End_Date: end,
          Contractor: { id: args.event.resource },
        },
        Trigger: ["workflow"],
      };

      ZOHO.CRM.API.updateRecord(new_config).then(function (data) {
        const newRecId = data.data[0]?.details?.id;

        ZOHO.CRM.API.getRelatedRecords({
          Entity: "Job_Allocations",
          RecordID: newRecId,
          RelatedList: "Attendance_Log",
          page: 1,
          per_page: 200,
        }).then(function (data) {
          const tempArr = data.data;
          const startDate = moment(changedEvent.start.toString());
          const endDate = moment(changedEvent.end.toString());
          // const daysBetween = endDate.diff(startDate, "days");

          let currentDate = startDate.clone();
          for (let i = 0; i < tempArr.length; i++) {
            // var APIData = {
            // 	Attendance_Date: currentDate.add(1, "days").format("YYYY-MM-DD"),
            // };
            var RelatedConfig = {
              Entity: "Project_Attendance",
              APIData: {
                id: tempArr[i].id,
                Attendance_Date: currentDate
                  .add(i, "days")
                  .format("YYYY-MM-DD"),
              },
              Trigger: ["workflow"],
            };
            ZOHO.CRM.API.updateRecord(RelatedConfig).then(function (data) {
              // console.log("tazwer", data);
              // window.location.reload(false);
            });
          }
        });
      });
    }
    ZOHO.CRM.API.getRelatedRecords({
      Entity: "Job_Allocations",
      RecordID: event_id,
      RelatedList: "Attendance_Log",
      page: 1,
      per_page: 200,
    }).then(function (data) {
      // console.log({ RelatedRec: data.data });
      if (data.data.length === 1) {
        ZOHO.CRM.API.updateRecord(config).then(function (data) {
          let ID = 0;
          if (data.data[0].status === "success") {
            toast({
              message: "Project Allocation Updated Successfully",
            });

            const startDate = moment(changedEvent.start.toString());
            const endDate = moment(changedEvent.end.toString());
            // console.log(startDate, endDate);
            const daysBetween = endDate.diff(startDate, "days");
            ID = data.data[0].details.id;
            // console.log({ daysBetween });

            ZOHO.CRM.API.getRecord({
              Entity: "Job_Allocations",
              approved: "both",
              RecordID: ID,
            }).then(function (data) {
              ///creating attendence for everyday////
              let currentDate = startDate.clone();
              // project_Name=  data.data[0].Project_Name
              for (let i = 0; i < daysBetween - 1; i++) {
                let attendenceData = {
                  Name: data.data[0].Project_Name,
                  Attendance_Confirmation: "Scheduled",
                  Attendance_Date: currentDate
                    .add(1, "days")
                    .format("YYYY-MM-DD"),
                  Scheduling: { id: ID },
                };
                ZOHO.CRM.API.insertRecord({
                  Entity: "Project_Attendance",
                  APIData: attendenceData,
                  Trigger: ["workflow"],
                });
              }
            });
          } else {
            toast({
              message: "There is something wrong",
            });
          }
        });
      } else if (data.data.length > 1 && data.data.length < diffDates) {
        const tempDateArr = [];
        data.data.map((item) => {
          tempDateArr.push(item.Attendance_Date);
        });
        const newDates = updatedDates.filter(
          (item) => !tempDateArr.includes(item)
        );
        ZOHO.CRM.API.updateRecord(config).then(function (data) {
          let ID = 0;
          if (data.data[0].status === "success") {
            toast({
              message: "Project Allocation Updated Successfully",
            });
            ID = data.data[0].details.id;
            // console.log(data.data[0])
            ZOHO.CRM.API.getRecord({
              Entity: "Job_Allocations",
              approved: "both",
              RecordID: ID,
            }).then(function (data) {
              newDates.map((item) => {
                let attendenceData = {
                  Name: data.data[0].Project_Name,
                  Attendance_Confirmation: "Scheduled",
                  Attendance_Date: item,
                  Scheduling: { id: ID },
                };
                ZOHO.CRM.API.insertRecord({
                  Entity: "Project_Attendance",
                  APIData: attendenceData,
                  Trigger: ["workflow"],
                })
                  .then
                  // console.log(d)
                  ();
              });
            });
          } else {
            toast({
              message: "There is something wrong",
            });
          }
        });
      } else {
        ZOHO.CRM.API.updateRecord(config).then(function (data) {
          // let ID = 0;
          if (data.data[0].status === "success") {
            toast({
              message: "Project Allocation Updated Successfully",
            });
            // Reload the page after successful update
            window.location.reload();
          } else {
            toast({
              message: "There is something wrong",
            });
          }
        });
        const newDates = data.data.filter(
          (item) => !updatedDates.includes(item.Attendance_Date)
        );
        newDates.map((item) => {
          // console.log(item.id);

          ZOHO.CRM.API.deleteRecord({
            Entity: "Project_Attendance",
            RecordID: item.id,
          }).then(function (data) {
            // console.log(data);
          });
        });
      }
    });
  }, []);

  const myColors = React.useMemo(() => {
    return [
      {
        background: "#F4F4F4",
        recurring: {
          repeat: "weekly",
          weekDays: "SA,SU",
        },
      },
    ];
  }, []);

  // Contractor order is now controlled by the worksboard_org_var org variable
  const [isOpen, setOpen] = React.useState(false);
  const [anchor, setAnchor] = React.useState(null);
  const timerRef = React.useRef(null);
  const [popupdata, setPopupData] = React.useState(null);

  const onEventHoverIn = React.useCallback(
    (args) => {
      setEventSelected(true);
      let tempEvent = args.event;

      const foundevent = myEvents.filter(
        (event) => event.event_id === tempEvent.event_id
      )[0];

      if (foundevent !== undefined) {
        // const result = activeProjects.find(
        //   (project) => foundevent.project_id === project.project_id);

        let excludedDate = [];

        if (foundevent.Excluded_Dates !== null) {
          const excludedDates = foundevent.Excluded_Dates.split(",").map(
            (dateStr) => {
              return moment(dateStr, "YYYY-MM-DD").format("YYYY-MM-DD"); // Parse the excluded dates using the specified format
            }
          );
          excludedDate = excludedDates;
        }
        // console.log({ excludedDate });
        setExcluded(excludedDate);
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

  //Excluded days looping
  let days = [];

  function dateRange(startDate, endDate, steps = 1) {
    const dateArray = [];
    const start = moment(startDate);
    const end = moment(endDate);
    const currentDate = start.clone();
    const daysBetween = end.diff(start, "days");
    for (let i = 0; i < daysBetween; i++) {
      dateArray.push(currentDate.format("YYYY-MM-DD"));
      currentDate.add(1, "days");
    }
    return [dateArray, daysBetween];
  }

  start__Date !== null &&
    end__Date !== null &&
    (days = dateRange(start__Date, end__Date));

  // console.log({myEventsWithExclusions})

  const [deleteDialog, setDeleteDialog] = React.useState(false);

  const handleClickOpen = () => {
    setDeleteDialog(true);
  };

  const handleClose = (value) => {
    setDeleteDialog(false);
  };
  const SortedActiveProjects = activeProjects.sort((a, b) =>
    a.displayName.localeCompare(b.displayName)
  );
  const sortedRectificationProjects = rectificationProject.sort((a, b) =>
    a.displayName.localeCompare(b.displayName)
  );
  const requestedProjectCount = taskTypes.reduce(
    (count, taskType) => count + taskType.tasks.length,
    0
  );

  console.log({ projects });

  return (
    <>
      <Box sx={{ height: "100vh", overflowY: "scroll", bgcolor: "#f8f8f8" }}>
        <Grid container>
          <Grid xs={9} sx={{ padding: "10px" }}>
            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div style={{ flexGrow: 1 }}>
                {/* This is a placeholder div to take up space and push the toggle to the right */}
              </div>
              <Tooltip title="Change contractor order">
                <IconButton onClick={openOrderModal} size="small">
                  <SettingsIcon />
                </IconButton>
              </Tooltip>
              <ViewToggle view={view} setView={setView} />
            </Box>
            <Eventcalendar
              themeVariant="light"
              view={{
                timeline: {
                  type: view,
                  eventList: true,
                  // Render three months in the month view so users can scroll
                  // horizontally through months instead of jumping/launching to a new month.
                  ...(view === "month" && { size: 3, columnWidth: "small" }),
                },
              }}
              colors={myColors}
              invalid={blockedProjects}
              data={myEvents}
              resources={myResources}
              dragToMove={true}
              externalDrop={true}
              eventOverlap={false}
              onEventCreate={onEventCreate}
              dragToResize={true}
              onEventUpdated={onEventUpdated}
              clickToCreate={false}
              dragToCreate={false}
              showEventTooltip={false}
              onEventClick={onEventHoverIn}
            />
          </Grid>
          <Grid
            xs={3}
            className="project-sidebar"
            sx={{
              height: "100vh",
              overflowY: "scroll",
            }}
          >
            {!eventSelected && (
              <Box className="project-search">
                <TextField
                  fullWidth
                  label="Search projects"
                  variant="outlined"
                  size="small"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </Box>
            )}
            {!eventSelected && normalizedSearchQuery !== "" && (
              <Box className="project-section">
                <Typography
                  component="h2"
                  className="project-section__title"
                >
                  Search Results
                  <span className="project-count">{searchResults.length}</span>
                </Typography>
                {searchResults.length > 0 ? (
                  <div className="project-list">
                    {searchResults.map((task) => (
                      <Task key={task.project_id} data={task} />
                    ))}
                  </div>
                ) : (
                  <Typography align="center" variant="body2">
                    No projects found
                  </Typography>
                )}
              </Box>
            )}
            {!eventSelected && rectificationProject.length > 0 && (
              <section className="project-section">
                <Typography
                  component="h2"
                  className="project-section__title"
                >
                  Rectification
                  <span className="project-count">
                    {rectificationProject.length}
                  </span>
                </Typography>
                <div className="project-list">
                  {sortedRectificationProjects.map((task) => (
                    <Task key={task.project_id} data={task} />
                  ))}
                </div>
              </section>
            )}
            {!eventSelected && (
              <Box className="project-section">
                <Typography
                  component="h2"
                  className="project-section__title"
                >
                  Projects Requested
                  <span className="project-count">{requestedProjectCount}</span>
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
            {!eventSelected && blockProject.length > 0 && (
              <section className="project-section">
                <Typography
                  component="h2"
                  className="project-section__title"
                >
                  Contractor Unavailable
                  <span className="project-count">{blockProject.length}</span>
                </Typography>
                <div className="project-list">
                  {blockProject.map((task) => (
                    <Task key={task.project_id} data={task} />
                  ))}
                </div>
              </section>
            )}
            {!eventSelected && (
              <section className="project-section">
                <Typography
                  component="h2"
                  className="project-section__title"
                >
                  In Progress
                  <span className="project-count">
                    {SortedActiveProjects.length}
                  </span>
                </Typography>
                <div className="project-list">
                  {SortedActiveProjects.map((task) => (
                    <Task key={task.project_id} data={task} />
                  ))}
                </div>
              </section>
            )}
          </Grid>
        </Grid>
        <DeleteDialog
          deleteDialog={deleteDialog}
          handleClose={handleClose}
          deleteData={popupdata}
          ZOHO={ZOHO}
        />
        <Modal
          open={eventSelected}
          onClose={() => setEventSelected(false)}
          aria-labelledby="modal-modal-title"
          aria-describedby="modal-modal-description"
        >
          <Box sx={modernStyle}>
            <Box
              display="flex"
              justifyContent="space-between"
              alignItems="center"
              mb={2}
            >
              <Typography
                id="modal-modal-title"
                variant="h6"
                component="h2"
                fontWeight="bold"
              >
                Event Details
              </Typography>
              <IconButton
                onClick={() => setEventSelected(false)}
                sx={{ p: 0.5 }}
              >
                <CloseIcon />
              </IconButton>
            </Box>

            <Typography variant="body1">
              <strong>Name:</strong> {popupdata?.title}
            </Typography>
            <Typography variant="body1">
              <strong>Project Summary:</strong>{" "}
              {popupdata?.Project_Summary || popupdata?.Scope_Of_Work}
            </Typography>
            <Typography variant="body1">
              <strong>CET:</strong> {popupdata?.estimated_time_budget}
            </Typography>

            <Box mt={3} display="flex" justifyContent="flex-end" gap={1}>
              <Button
                variant="outlined"
                color="error"
                onClick={() => setEventSelected(false)}
              >
                Cancel
              </Button>
              <Button
                variant="contained"
                color="success"
                onClick={() => handleAccept(popupdata, ZOHO, setEventSelected)}
              >
                Accept All
              </Button>
              <Button
                variant="contained"
                color="error"
                onClick={() => handleDelete(popupdata, ZOHO)}
              >
                Delete All
              </Button>
            </Box>
          </Box>
        </Modal>
        <Modal
          open={orderModalOpen}
          onClose={() => setOrderModalOpen(false)}
          aria-labelledby="contractor-order-title"
        >
          <Box
            sx={{
              ...modernStyle,
              width: "450px",
              maxHeight: "80vh",
              overflowY: "auto",
            }}
          >
            <Box
              display="flex"
              justifyContent="space-between"
              alignItems="center"
              mb={2}
            >
              <Typography
                id="contractor-order-title"
                variant="h6"
                component="h2"
                fontWeight="bold"
              >
                Contractor Order
              </Typography>
              <IconButton
                onClick={() => setOrderModalOpen(false)}
                sx={{ p: 0.5 }}
              >
                <CloseIcon />
              </IconButton>
            </Box>

            <Typography variant="body2" mb={2}>
              Use the arrows to reorder contractors. New contractors not listed
              will appear at the end.
            </Typography>

            <List dense>
              {draftOrder.map((name, index) => (
                <ListItem
                  key={name}
                  secondaryAction={
                    <Box>
                      <IconButton
                        edge="end"
                        disabled={index === 0 || savingOrder}
                        onClick={() => moveDraftItem(index, -1)}
                        size="small"
                      >
                        <ArrowUpwardIcon />
                      </IconButton>
                      <IconButton
                        edge="end"
                        disabled={index === draftOrder.length - 1 || savingOrder}
                        onClick={() => moveDraftItem(index, 1)}
                        size="small"
                      >
                        <ArrowDownwardIcon />
                      </IconButton>
                    </Box>
                  }
                >
                  <ListItemText primary={name} />
                </ListItem>
              ))}
            </List>

            <Box mt={2} display="flex" justifyContent="flex-end" gap={1}>
              <Button
                variant="outlined"
                onClick={() => setOrderModalOpen(false)}
                disabled={savingOrder}
              >
                Cancel
              </Button>
              <Button
                variant="contained"
                onClick={saveContractorOrder}
                disabled={savingOrder}
              >
                {savingOrder ? "Saving..." : "Save"}
              </Button>
            </Box>
          </Box>
        </Modal>
      </Box>
    </>
  );
}

export default Calendar;

function Task(props) {
  const [draggable, setDraggable] = React.useState();

  const setDragElm = React.useCallback((elm) => {
    setDraggable(elm);
  }, []);

  // Determine if the project is blocked
  const isBlockedProject = props.data.title === "Blocked Project";
  const statusClass = isBlockedProject
    ? "external-event-task--blocked"
    : props.data.color === "red"
    ? "external-event-task--rectification"
    : props.data.color === "#4CAF50"
    ? "external-event-task--in-progress"
    : "external-event-task--requested";
  const budget = props.data.estimated_time_budget || "(n/a)";
  const label = `${props.data.displayName}: CET ${budget}`;

  return (
    <div
      ref={setDragElm}
      className={`external-event-task ${statusClass}`}
    >
      <Tooltip title={`${props.data.work_summary}`} placement="left-start">
        <a
          className="external-event-task__link"
          href={props.data.crmUrl}
          target="_blank"
          rel="noopener noreferrer"
          draggable="false"
          onClick={(event) => event.stopPropagation()}
          aria-label={`Open ${props.data.displayName} in Zoho CRM`}
        >
          <span className="external-event-task__label">{label}</span>
          <OpenInNewIcon className="external-event-task__open-icon" />
        </a>
      </Tooltip>
      <Draggable dragData={props.data} element={draggable} />
    </div>
  );
}
