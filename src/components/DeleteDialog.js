import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle } from '@mui/material'
import React from 'react'
import { handleDelete } from './helpingFunctions'

function DeleteDialog({ handleClose, deleteDialog, deleteData, ZOHO }) {

    return (
        <Dialog onClose={handleClose} open={deleteDialog}>
            <DialogTitle id="alert-dialog-title">
                {"Are you Sure you want to delete the Job Allocation?"}
            </DialogTitle>
            <DialogContent>
                <DialogContentText id="alert-dialog-description">
                    
                </DialogContentText>
            </DialogContent>
            <DialogActions>
                <Button onClick={handleClose} variant="outlined">No, I don't</Button>
                <Button onClick={() => handleDelete(deleteData, ZOHO)} color="error" variant="contained">
                    Yes, Delete
                </Button>
            </DialogActions>

        </Dialog>
    )
}

export default DeleteDialog
