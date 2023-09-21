import { DatePicker, LocalizationProvider } from '@mui/lab'
import AdapterDateFns from '@mui/lab/AdapterDateFns'
import {
  Alert,
  Box,
  Button,
  Card,
  InputLabel,
  Snackbar,
  TextField,
  Typography,
} from '@mui/material'
import FormControl from '@mui/material/FormControl'
import MenuItem from '@mui/material/MenuItem'
import Select from '@mui/material/Select'
import moment from 'moment'
import React, { useState } from 'react'
import ExcludeDates from '../ExcludeDates/ExcludeDates'
import './InputForm.css'

const ZOHO = window.ZOHO

//for assigning project color

function projectColor(projectTiming) {
  let color = ''
  if (projectTiming === 'Urgent') {
    color = '#eb4d4d'
  } else if (projectTiming === 'Term 1 school holidays') {
    color = '#c4f0b3'
  } else if (projectTiming === 'Term 2 school holidays') {
    color = '#98d681'
  } else if (projectTiming === 'Term 3 school holidays') {
    color = '#67c480'
  } else if (projectTiming === 'Term 4 School holidays') {
    color = '#8a37be'
  } else if (projectTiming === 'Specific date provided') {
    color = '#acacac'
  } else if (projectTiming === 'Weekend works') {
    color = '#ffda62'
  } else {
    color = 'black'
  }
  return color
}

const InputForm = (props) => {
  const [painter, setPainter] = useState('')
  const [project, setProject] = useState('')
  const [startDate, setStartDate] = useState(null)
  const [endDate, setEndDate] = useState(null)
  const [excluded, setExcluded] = useState([''])
  const [snackbarOpen, setsnackbarOpen] = React.useState(false)


  const { selectedProject, painters, setFormSubmitted,handleModalClose } = props;
  //snack bar handler
  const handleSnackbarClose = (event, reason) => {
    if (reason === 'clickaway') {
      return
    }
    setsnackbarOpen(false)
  }
  //Painter state handler if painter changed
  const handlePainterChange = (event) => {
    setPainter(event.target.value)
  }
  //Project state handler if painter changed
  const handleProjectChange = (event) => {
    setProject(event.target.value)
  }
  //Job allocation button handler
  const handleAllocateJob = () => {
    let recordData = {
      Projects: selectedProject,
      Contractor: painter,
      Start_Date: moment(startDate).format('YYYY-MM-DD'),
      End_Date: moment(endDate).format('YYYY-MM-DD'),
      Excluded_Dates: JSON.stringify(excluded),
    }
    ZOHO.CRM.API.insertRecord({
      Entity: 'Job_Allocations',
      APIData: recordData,
      Trigger: ['workflow'],
    }).then(function (data) {
      data.data[0].code === 'SUCCESS' && setsnackbarOpen(true)
      setPainter('')
      setProject('')
      setStartDate('')
      setEndDate('')
      setExcluded([])
      setFormSubmitted()
    })
  }

  //Excluded days looping
  let days = []

  function dateRange(startDate, endDate, steps = 1) {
    const dateArray = []
    for (
      let m = moment(startDate);
      m.diff(endDate, 'days') <= 0;
      m.add(1, 'days')
    ) {
      dateArray.push(m.format('YYYY-MM-DD'))
    }
    return dateArray
  }

  startDate !== null &&
    endDate !== null &&
    (days = dateRange(startDate, endDate))

    console.log({selectedProject})

  return (
    <Box sx={{p: 5}}>
      <Typography
        variant="h4"
        align="center"
        sx={{ fontWeight: 'bold', margin: '-10px 0px 10px 0px' }}
      >
        Assign Jobs
      </Typography>
      <Box className="input-card-container">
        {/* Project select input */}
        <Box sx={{ display: 'flex' }}>
          <label className="input-label">Project:</label>
          <TextField defaultValue={selectedProject?.Name} />
        </Box>
        {/* Painter select input */}
        <Box sx={{ display: 'flex' }}>
          <label className="input-label">Painter</label>
          <FormControl sx={{ m: 1, width: '100%' }}>
            <InputLabel>Select Painter....</InputLabel>
            <Select
              value={painter}
              onChange={handlePainterChange}
              label="Painter List"
            >
              {painters?.map((painter, index) => (
                <MenuItem value={painter.id} key={index}>
                  {`${painter.First_Name + ' ' + painter.Last_Name}`}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
        <br />
        {/* Start date select input */}
        <Box sx={{ display: 'flex' }}>
          <label className="input-label">Start Date</label>
          <LocalizationProvider dateAdapter={AdapterDateFns}>
            <DatePicker
              label="Select Start Date"
              value={startDate}
              onChange={(newValue) => {
                setStartDate(newValue)
              }}
              renderInput={(params) => <TextField {...params} />}
            />
          </LocalizationProvider>
        </Box>
        <br />
        {/* End date select input */}
        <Box sx={{ display: 'flex' }}>
          <label className="input-label">End Date</label>
          <LocalizationProvider dateAdapter={AdapterDateFns}>
            <DatePicker
              label="Select End Date"
              value={endDate}
              onChange={(newValue) => {
                setEndDate(newValue)
              }}
              renderInput={(params) => <TextField {...params} />}
            />
          </LocalizationProvider>
        </Box>
        <br />
        {/* Excluded date select input */}
        <ExcludeDates days={days} setExcluded={setExcluded} />
        <br />
        {/* Job allocation handler */}
        <Button
          sx={{ marginTop: '10px' }}
          variant="contained"
          color="success"
          onClick={handleAllocateJob}
        >
          Allocate Job
        </Button>
      </Box>
      {/* Snack bar */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={6000}
        onClose={handleSnackbarClose}
      >
        <Alert
          onClose={handleSnackbarClose}
          severity="success"
          sx={{ width: '100%' }}
        >
          Job Allocation was successful
        </Alert>
      </Snackbar>
    </Box>
  )
}

export default InputForm
