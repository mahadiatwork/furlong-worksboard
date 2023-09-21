import * as React from "react";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import {
  Dialog,
  DialogContent,
  DialogTitle,

} from "@mui/material";
import InputForm from "../../components/InputForm/InputForm"
import { useState } from "react";


export default function ProjectTable({ projects,painters,setFormSubmitted,setReload }) {
  const [open, setOpen] = React.useState(false);
  //   const [selectedValue, setSelectedValue] = useState();
  const [selectedProject,setSelectedProject] = useState({})

  const handleModalOpen = (project) => {
    setOpen(true);
    setSelectedProject(project)
  };

  const handleClose = (value) => {
    setOpen(false);
    // setSelectedValue(value);
  };
  return (
    <TableContainer sx={{ maxHeight: "100vh" }}>
      <Table sx={{ minWidth: 650 }} stickyHeader aria-label="sticky table">
        <TableHead>
          <TableRow>
            <TableCell sx={{ bgcolor: "black", color: "white" }}>
              Project Name
            </TableCell>
            <TableCell sx={{ bgcolor: "black", color: "white" }} align="center">
              Summary
            </TableCell>
            <TableCell sx={{ bgcolor: "black", color: "white" }} align="center">
              Estimated Time and Timing (School Holidays + School Term)
            </TableCell>
          </TableRow>
        </TableHead>
        {/* <TableBody>
          {projects.length > 0 &&
            projects.map((project) => (
              <TableRow
                key={project.id}
                sx={{
                  "&:last-child td, &:last-child th": { border: 0 },
                  cursor: "pointer",
                  "&:hover": {
                    backgroundColor: 'lightblue'
                  },

                }}
                onClick={() => handleModalOpen(project)}
              >
                <TableCell component="th" scope="row">
                  {project.Name}
                </TableCell>
                <TableCell align="center">
                  {project.Work_Summary_Sale}
                </TableCell>
                <TableCell align="center">
                  {project.Budget_time_Add_Remove}
                </TableCell>
              </TableRow>
            ))}
        </TableBody> */}
      </Table>
      <SimpleDialog open={open} onClose={handleClose} selectedProject={selectedProject} painters={painters} setFormSubmitted={setFormSubmitted}  setReload={setReload} setOpen={setOpen} />
    </TableContainer>
  );
}

function SimpleDialog(props) {
  const { open,selectedProject,painters,setFormSubmitted,setReload,setOpen } = props;

  const handleClose = () => {
    setOpen(false);
  };

  return (
    <Dialog onClose={handleClose} open={open} fullWidth maxWidth="md">
      <DialogContent>
        <InputForm
          painters={painters}
          setFormSubmitted={setFormSubmitted}
          setReload={setReload}
          // handleModalClose={handleClose}
          selectedProject={selectedProject}
        />
      </DialogContent>
    </Dialog>
  );
}
