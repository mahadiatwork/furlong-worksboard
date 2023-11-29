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
import { DatePicker, LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterMoment } from "@mui/x-date-pickers/AdapterMoment";
import { handleDelete, handleUpdate, sortDates } from "./helpingFunctions";
import dayjs from "dayjs";
import ExcludeDates from "./ExcludeDates";
import DeleteDialog from "./DeleteDialog";
import { useMemo } from "react";

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
	events,
	projects,
	inProgress,
	blockedProjects,
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
	// const [myEvents, setMyEvents] = useState([])
	// console.log({ blockedProjects });

	const view = React.useMemo(() => {
		return {
			timeline: {
				type: "month",
				rowHeight: "equal",
				eventCreation: "false",
			},
		};
	}, []);
	const sortedContractor = [
		"Donny",
		"Troy",
		"William",
		"John",
		"Keith",
		"Sayed A",
		"Jobanpreet",
		"Andy",
		"Parimal",
		"Muhummad",
		"Daniel",
		"Anoop",
		"Christine",
		"Farhad",
		"Michael",
	];
	const myResources = [];
	const myEvents = [];
	const tasks = [];
	const track = [];
	const outsider = [];

	if (contractors.length > 0) {
		sortedContractor.map((item) => {
			contractors.map((name) => {
				if (name.First_Name === item) {
					myResources.push({
						id: name?.id,
						name: name.First_Name + " " + name.Last_Name,
						color: accepted ? "#C4F0B3" : "blue",
					});
				}
			});
		});
	}

	if (events.length > 0) {
		events.forEach((event) => {
			
			if (event.Projects !== null) {
				myEvents.push({
					start: event.Start_Date,
					end: moment(event.End_Date).format("YYYY-MM-DD"),
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

	/* ------------------ Fahims Task --------------- */

	const onEventCreate = React.useCallback(async (event) => {
		const start_date = moment(event.event.start.toString());
		const end_date = moment(event.event.end.toString());
		// console.log({ event });
		const days_in_between = end_date.diff(start_date, "days");
		
    let  recordData ={}
    if (event?.event?.title === "Blocked Project") {
      recordData = {
       Start_Date: start_date.format("YYYY-MM-DD"),
       End_Date: end_date.format("YYYY-MM-DD"),
       Projects: { id: event?.event?.project_id },
       Contractor: { id: event?.event?.resource },
       Project_Name: event?.event?.title,
       Type:"Blocked"
     };
    }else{
      recordData = {
        Start_Date: start_date.format("YYYY-MM-DD"),
        End_Date: end_date.format("YYYY-MM-DD"),
        Projects: { id: event?.event?.project_id },
        Contractor: { id: event?.event?.resource },
        Project_Name: event?.event?.title,
      };
    }
		
		await ZOHO.CRM.API.insertRecord({
			Entity: "Job_Allocations",
			APIData: recordData,
			Trigger: ["workflow"],
		}).then(function (data) {
			if (data.data[0].status === "success") {
				toast({
					message: "Project Allocated Successfully",
				});
				console.log("max",event.event)
				let attendenceData={}
				if (event.event.title) {
					attendenceData = {
						Name: event.event.title,
						Attendance_Confirmation: "Contractor Unavailable",
						Attendance_Date: start_date.format("YYYY-MM-DD"),
						Scheduling: { id: data.data[0].details.id },
					};
				}else{
					attendenceData = {
						Name: event.event.title,
						Attendance_Confirmation: "Scheduled",
						Attendance_Date: start_date.format("YYYY-MM-DD"),
						Scheduling: { id: data.data[0].details.id },
					};
				}
				ZOHO.CRM.API.insertRecord({
					Entity: "Project_Attendance",
					APIData: attendenceData,
					Trigger: ["workflow"],
				}).then(function (data) {
					
          // if (event?.event?.title === "Blocked Project") {
          //   var blockConfig={
          //     Entity:"Job_Allocations",
          //     APIData:{
          //           "id": job_allocation_id,
          //           "Type": "Blocked"
          //     },
          //     Trigger:["workflow"]
          //   }
          //   ZOHO.CRM.API.updateRecord(blockConfig)
          //   .then(function(data){
          //       
          //   })
          // }
				});
				// const config = {
				//   Entity: "FP_Projects",
				//   APIData: {
				//     id: event.event.project_id,
				//     Job_Offer_Status: "Allocated",
				//   },
				//   Trigger: ["workflow"],
				// };
				// ZOHO.CRM.API.updateRecord(config).then(function (data) {
				//   console.log(data);
				// });
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
			project_id: project?.id || "",
			work_summary: project?.Work_Summary_Sale || "",
			estimated_time_budget: project?.Budget_time_Add_Remove || "",
			Project_Timing: project?.Project_Timing || "",
			start: moment(now).format("YYYY-MM-DD"),
			end: moment(now).format("YYYY-MM-DD"),
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
	const blockProject =[]

	if (inProgress.length > 0) {
		inProgress.forEach((project) => {
			if (project.Account_name === "Blocked Project") {
				blockProject.push(createTask(project, "#f25e5e"));
			} else {
				activeProjects.push(createTask(project, "#C4F0B3"));
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
		const end = moment(changedEvent.end.toString()).format("YYYY-MM-DD");

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
				End_Date: moment(changedEvent.end.toString()).format("YYYY-MM-DD"),
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
					End_Date: moment(args.event.end.toString()).format("YYYY-MM-DD"),
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

		// await ZOHO.CRM.API.updateRecord(config).then(function (data) {
		// 	let ID =0;
		// 	if (data.data[0].status === "success") {
		// 		toast({
		// 			message: "Project Allocation Updated Successfully",
		// 		});

		// 		const startDate = moment(changedEvent.start.toString());
		// 		const endDate = moment(changedEvent.end.toString());
		// 		console.log(startDate, endDate);
		// 		const daysBetween = endDate.diff(startDate, "days");
		// 		 ID = data.data[0].details.id;
		// 		console.log({ daysBetween });

		// 		ZOHO.CRM.API.getRecord({
		// 			Entity: "Job_Allocations",
		// 			approved: "both",
		// 			RecordID: ID,
		// 		}).then(function (data) {
		// 			///creating attendence for everyday////
		// 			let currentDate = startDate.clone();

		// 			for (let i = 0; i < daysBetween-1; i++) {
		// 				let attendenceData = {
		// 					Name: data.data[0].Project_Name,
		// 					Attendance_Confirmation: "Scheduled",
		// 					Attendance_Date: currentDate.add(1, 'days').format("YYYY-MM-DD"),
		// 					Scheduling: { id: ID },
		// 				};
		// 				ZOHO.CRM.API.insertRecord({
		// 					Entity: "Project_Attendance",
		// 					APIData: attendenceData,
		// 					Trigger: ["workflow"],
		// 				});
		// 			}

		// 			// console.log(data);
		// 		});
		// 		// console.log({updatedData:data});
		// 	} else {
		// 		toast({
		// 			message: "There is something wrong",
		// 		});
		// 	}
		// });
		// ...
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

	// useEffect(()=>{

	// },[])
	var indexOf = 0;
	// const myInvalids = useMemo(() => {
	// 	// console.log({ start: blockedProjects[0].Start_Date });
	// 	// console.log({ end: blockedProjects[0].End_Date });
	// 	// console.log({ id: blockedProjects[0].Contractor.id });

	// 	// const yesterday = blockedProjects[0].Start_Date;
	// 	// const today = blockedProjects[0].End_Date;
	// 	// setResources(blockedProjects[0].Contractor.id);
	// 	// const resource = blockedProjects[0].Contractor.id.toString()
	// 	const now = new Date();
	// 	const today = new Date(now.setMinutes(59));
	// 	const yesterday = new Date(
	// 		now.getFullYear(),
	// 		now.getMonth(),
	// 		now.getDate() - 1
	// 	);

	// 	return [
	// 		{
	// 			// background: "#f2f4f7",
	// 			// recurring: {
	// 			// 	repeat: "weekly",
	// 			// 	weekDays: "SA,SU",
	// 			// },
	// 			resource: "1915689000015207400",
	// 			// resource: resource,
	// 			start: yesterday,
	// 			end: today,
	// 		},
	// 	];
	// }, []);

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

	const handleAccept = (even_data, ZOHO) => {
		const id = even_data.event_id;
		ZOHO.CRM.API.getRelatedRecords({
			Entity: "Job_Allocations",
			RecordID: id,
			RelatedList: "Attendance_Log",
			page: 1,
			per_page: 200,
		}).then(function (data) {
			data.data.map((item) => {
				var config = {
					Entity: "Project_Attendance",
					APIData: {
						id: item.id,
						Attendance_Confirmation: "Attended",
					},
					Trigger: ["workflow"],
				};
				ZOHO.CRM.API.updateRecord(config).then(function (data) {
					// console.log(data);
					var config = {
						Entity: "Job_Allocations",
						APIData: {
							id: id,
							Color_Code: "#C4F0B3",
						},
						Trigger: ["workflow"],
					};
					ZOHO.CRM.API.updateRecord(config).then(function (data) {
						// console.log(data);
						setEventSelected(false);
						window.location.reload(false);
					});
				});
			});
		});
	};
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
	const SortedActiveProjects =activeProjects.sort((a, b) => a.title.localeCompare(b.name))
	

	return (
		<Box sx={{ height: "100vh", overflowY: "hidden", bgcolor: "#f8f8f8" }}>
			<Grid container>
				<Grid xs={9} sx={{ padding: "10px" }}>
					<Eventcalendar
						themeVariant="light"
						view={{
							timeline: {
								type: "month",
								size: 21,
								// resolutionHorizontal: "day",
								eventList: true,
								weekNumbers: false,
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
								Contractor Unavailable
							</Typography>
							<div>
								{blockProject.map((task, i) => (
									<Task key={i} data={task} />
								))}
							</div>
						</div>
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
								{SortedActiveProjects.map((task, i) => (
									<Task key={i} data={task} />
								))}
							</div>
						</div>
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
				<Box sx={style} display={'flex'} flexWrap={'wrap'} justifyContent={'space-around'}>
					<Button
						variant="outlined"
						color="error"
						onClick={() => setEventSelected(false)}
						// sx={{ mr: 10, ml: 5 }}
					>
						Cancel
					</Button>
					
					<Button
						variant="contained"
						color="success"
						onClick={() => handleAccept(popupdata, ZOHO)}
					>
						Accept All
					</Button>
					<Button variant="contained" color="error" onClick={()=>handleDelete(popupdata,ZOHO)}>
						Delete All
					</Button>
					
				</Box>
			</Modal>
		</Box>
	);
}

export default Calendar;

function Task(props) {
	const [draggable, setDraggable] = React.useState();
	
	const setDragElm = React.useCallback((elm) => {
		// console.log({ elm });
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
					{props.data.title === "Blocked Project"
						? props.data.title
						: props.data.title +
						  ": CET - " +
						  `${props.data.estimated_time_budget || "(n/a)"}`}
				</Button>
			</Tooltip>
			<Draggable dragData={props.data} element={draggable} />
		</div>
	);
}
