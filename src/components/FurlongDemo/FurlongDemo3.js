import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew'
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos'
import {
  Box,
  Button,
  Modal,
  Slide,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import Backdrop from '@mui/material/Backdrop'
import { styled } from '@mui/system'
import moment from 'moment'
import React, { Fragment, useState } from 'react'

//modal styling
const style = {
  position: 'absolute',
  top: '30%',
  left: '45%',
  transform: 'translate(-50%, -50%)',
  transition: '2s',
  width: 400,
  bgcolor: 'background.paper',
  border: 'none',
  boxShadow: 24,
  pt: 2,
  px: 4,
  pb: 3,
}

//custom table container for scrolling
const CustomTableContainer = styled('TableContainer')({
  overflowX: 'scroll',
})

const ZOHO = window.ZOHO
//handle delete on modal pop over
const handleDelete = (id) => {
  ZOHO.CRM.API.deleteRecord({ Entity: 'Job_Allocations', RecordID: id }).then(
    function (data) {
      window.location.reload()
    },
  )
}

// const formatEvent = (
//   startDate,
//   endDate,
//   excluded,
//   project_name,
//   painter_name,
//   project_color,
//   project_scope,
// ) => {
//   const dateFormat = 'YYYY-MM-DD'
//   let resultRange = []
//   let tempDate = moment(startDate, dateFormat)
//   let tempStartDate = startDate
//   while (tempDate < moment(endDate, dateFormat)) {
//     const nextDate = moment(tempDate.format(dateFormat), dateFormat)
//       .add(1, 'days')
//       .format(dateFormat)
//     if (
//       excluded.includes(nextDate) ||
//       excluded.includes(tempDate.format(dateFormat))
//     ) {
//       if (!excluded.includes(tempStartDate)) {
//         resultRange.push({
//           startDate: tempStartDate,
//           endDate: tempDate.format(dateFormat),
//           projectName: project_name,
//           painterName: painter_name,
//           projectColor: project_color,
//           projectScope: project_scope,
//           slot: tempDate.diff(moment(tempStartDate, dateFormat), 'days') + 1,
//         })
//       }
//       tempStartDate = nextDate
//     }
//     tempDate = tempDate.add(1, 'days')
//   }
//   if (!excluded.includes(tempDate.format(dateFormat))) {
//     resultRange.push({
//       startDate: tempStartDate,
//       endDate: tempDate.format(dateFormat),
//       projectName: project_name,
//       painterName: painter_name,
//       projectColor: project_color,
//       projectScope: project_scope,
//       slot: tempDate.diff(moment(tempStartDate, dateFormat), 'days') + 1,
//     })
//   }
//   return resultRange
// }

//calendar - Header
const getDaysOfWeek = (day) => {
  if (day === 1) {
    return 'Mon'
  } else if (day === 2) {
    return 'Tues'
  } else if (day === 3) {
    return 'Wed'
  } else if (day === 4) {
    return 'Thu'
  } else if (day === 5) {
    return 'Fri'
  } else if (day === 6) {
    return 'Sat'
  } else if (day === 0) {
    return 'Sun'
  }
}

//main component function
export default function FurlongDemo3({ painters, projects, events }) {
  const [start_date, setstart_date] = useState(
    moment().startOf('month').format('DD-MM-YYYY'),
  )
  const [inRange, setInRange] = useState(false)
  const [end_date, setend_date] = useState(
    moment().startOf('month').add(7, 'days'),
  )
  const [currentMonth, setCurrentMonth] = useState(moment().format('MMMM-YYYY'))
  //modal
  const [clickedEvent, setClickedEvent] = useState({})
  //snakbar states
  const [open, setOpen] = React.useState(false)
  const handleOpen = () => setOpen(true)
  const handleClose = () => setOpen(false)

  //Calendar days
  let calendarDays = []
  let weekDays = []
  for (
    let m = moment(start_date, 'DD-MM-YYYY');
    m.diff(moment(end_date, 'DD-MM-YYYY'), 'days') < 0;
    m.add(1, 'days')
  ) {
    calendarDays.push(m.format('DD') + ' ' + getDaysOfWeek(moment(m).day()))
    weekDays.push(m.format('YYYY-MM-DD'))
  }
  //calendar - Next - Prev - Today - Button
  const handleNext = () => {
    setstart_date(
      moment(start_date, 'DD-MM-YYYY').add(7, 'days').format('DD-MM-YYYY'),
    )
    setend_date(
      moment(start_date, 'DD-MM-YYYY').add(14, 'days').format('DD-MM-YYYY'),
    )
    setCurrentMonth(
      moment(end_date, 'DD-MM-YYYY').add(7, 'days').format('MMMM-YYYY'),
    )
  }
  const handleToday = () => {}
  const handlePrev = () => {
    setstart_date(
      moment(start_date, 'DD-MM-YYYY').subtract(7, 'days').format('DD-MM-YYYY'),
    )
    setCurrentMonth(
      moment(start_date, 'DD-MM-YYYY').subtract(7, 'days').format('MMMM-YYYY'),
    )
    setend_date(start_date)
  }

  const IndividualPainterPorjects = {}

  events.length > 0 &&
    events.map((event) => {
      if (
        event?.Contractor?.name !== undefined &&
        IndividualPainterPorjects[`${event?.Contractor?.name}`] === undefined &&
        moment(event.Start_Date).isBefore(weekDays[0]) !== true
      ) {
        IndividualPainterPorjects[`${event?.Contractor?.name}`] = {
          detail: [
            {
              project: event.Projects,
              start_date: event.Start_Date,
              end_date: event.End_Date,
              Excluded_Dates: event?.Excluded_Dates,
              Color_Code: event.Color_Code,
              scope_of_work: event.Scope_Of_Work,
            },
          ],
        }
      } else if (
        event?.Contractor?.name !== undefined &&
        IndividualPainterPorjects[`${event?.Contractor?.name}`] !== undefined &&
        moment(event.Start_Date).isBefore(weekDays[0]) !== true
      ) {
        IndividualPainterPorjects[`${event?.Contractor?.name}`].detail.push({
          project: event.Projects,
          start_date: event.Start_Date,
          end_date: event.End_Date,
          Excluded_Dates: event?.Excluded_Dates,
          Color_Code: event.Color_Code,
          scope_of_work: event.Scope_Of_Work,
        })
      }
    })

  Object.keys(IndividualPainterPorjects).map((item) => {
    IndividualPainterPorjects[item]?.detail?.map((detail, index) => {
      const tempArray = []
      for (
        let m = moment(detail.start_date, 'YYYY-MM-DD');
        m.diff(moment(detail.end_date, 'YYYY-MM-DD'), 'days') < 1;
        m.add(1, 'days')
      ) {
        if (
          detail.Excluded_Dates.includes(moment(m).format('YYYY-MM-DD')) !==
          true
        ) {
          tempArray.push(moment(m).format('YYYY-MM-DD'))
        } else {
          tempArray.push('')
        }
      }
      detail['calendarDates'] = tempArray
    })
  })

  console.log(IndividualPainterPorjects)
  return (
    <Box sx={{ marginTop: '20px', boxShadow: '5px' }}>
      {/*Table outer div heading */}
      <Box className="table-top">
        <div></div>
        <Typography
          variant="h5"
          sx={{ fontWeight: 'bold', margin: '2px 0px 0px 30px' }}
        >
          {currentMonth}
        </Typography>
        <Box
          sx={{
            display: 'flex',
            margin: '4px 0px 0px 5px',
            alignContent: 'flex-end',
          }}
        >
          <ArrowBackIosNewIcon onClick={handlePrev} className="next-prev-btn" />
          <p className="today-btn">Today</p>
          <ArrowForwardIosIcon onClick={handleNext} className="next-prev-btn" />
        </Box>
      </Box>
      {/*Table header */}
      <CustomTableContainer>
        <Table
          className="table-main"
          stickyHeader
          style={{ tableLayout: 'fixed' }}
        >
          <TableHead>
            <TableRow className="table-header">
              <TableCell>
                <Typography sx={{ fontWeight: 'bold' }}>
                  Active Painters
                </Typography>
              </TableCell>
              {calendarDays.map((day, index) => (
                <TableCell
                  key={index}
                  sx={{
                    color: '#318df2',
                    fontWeight: 'bold',
                    backgroundColor: '#F7FCFE',
                    borderLeft: '1px solid rgba(224, 224, 224, 1)',
                    textAlign: 'center',
                  }}
                >
                  {day}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          {/*Table data */}
          <TableBody>
            {Object.keys(IndividualPainterPorjects).map((name, index) => (
              <Fragment key={index}>
                <TableRow>
                  <TableCell
                    rowSpan={IndividualPainterPorjects[name].detail.length + 1}
                  >
                    {name}
                  </TableCell>
                </TableRow>

                {IndividualPainterPorjects[name].detail.map((detail) => (
                  <TableRow key={index} onClick={() => console.log(detail)}>
                    {detail?.calendarDates?.map((date) => (
                      <>
                        <TableCell
                          sx={{
                            backgroundColor: `${
                              date !== '' && detail.Color_Code
                            }`,
                            color: 'white',
                          }}
                        >
                          {date}
                        </TableCell>
                      </>
                    ))}
                  </TableRow>
                ))}
              </Fragment>
            ))}
          </TableBody>
        </Table>
      </CustomTableContainer>

      {/*Table Modal */}
      <Modal
        open={open}
        onClose={handleClose}
        aria-labelledby="parent-modal-title"
        aria-describedby="parent-modal-description"
        transition={Slide}
        BackdropComponent={Backdrop}
        BackdropProps={{
          timeout: 500,
        }}
      >
        <Box sx={{ ...style, width: 400 }}>
          <h2 id="parent-modal-title"></h2>
          <Typography>Scope of Work</Typography>
          <Box sx={{ padding: '10px', border: '1px solid lightgrey' }}></Box>
          <br />
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <a
              // href={`https://crm.zoho.com/crm/org465508368/tab/CustomModule23/${clickedEvent.projectId}`}
              href=""
              target="_blank"
              className="view-project-btn"
            >
              <Button>View Project</Button>
            </a>
            <Button
              variant="contained"
              color="error"
              onClick={() => handleDelete(clickedEvent.id)}
            >
              Delete
            </Button>
          </Box>
        </Box>
      </Modal>
    </Box>
  )
}
