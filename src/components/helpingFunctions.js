import moment from "moment";

export function sortDates(dates) {
	// Convert the date strings to Moment objects
	const momentDates = dates.map((dateStr) => moment(dateStr, "YYYY-MM-DD"));

	// Sort the Moment objects in ascending order
	momentDates.sort((a, b) => a - b);

	// Convert the sorted Moment objects back to date strings
	const sortedDates = momentDates.map((date) => date.format("YYYY-MM-DD"));

	return sortedDates;
}

export const handleUpdate = async (start, end, excluded, event_data, ZOHO) => {
	const excludedDate = excluded.join();
	var config = {
		Entity: "Job_Allocations",
		APIData: {
			id: event_data.event_id,
			Start_Date: moment(start).format("YYYY-MM-DD"),
			End_Date: moment(end).format("YYYY-MM-DD"),
			Excluded_Dates: excludedDate,
		},
		Trigger: ["workflow"],
	};
	await ZOHO.CRM.API.updateRecord(config).then(function (data) {
		alert("Job Allocation Updated Successfully");
		window.location.reload();
	});
};

export const handleDelete = async (event_data, ZOHO) => {
	// console.log({ event_data });
	ZOHO.CRM.API.getRelatedRecords({
		Entity: "Job_Allocations",
		RecordID: event_data.event_id,
		RelatedList: "Attendance_Log",
		page: 1,
		per_page: 200,
	}).then(function (data) {
		const relatedRec = data.data;
		relatedRec.map((item) => {
			ZOHO.CRM.API.deleteRecord({
				Entity: "Project_Attendance",
				RecordID: item.id,
			}).then(function (data) {
				console.log('deleted successfully')
			});
		});
		console.log({ relatedRec });
	});
	await ZOHO.CRM.API.deleteRecord({
		Entity: "Job_Allocations",
		RecordID: event_data.event_id,
	}).then(function (data) {
		alert("Job Allocation record deleted Successfully");
		window.location.reload();
	});
};


export const handleAccept = (even_data, ZOHO, setEventSelected) => {
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