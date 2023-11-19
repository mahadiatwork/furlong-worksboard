import React, { createContext, useState } from "react";

export const CalendarContex = createContext();

const CalendarStateProvider = ({ children }) => {
	const [invalidStartDate, setInvalidStartDate] = useState("");
	const [invalidEndDate, setInvalidEndDate] = useState("");
	return (
		<CalendarContex.Provider
			value={{
				invalidStartDate,
				invalidEndDate,
				setInvalidStartDate,
				setInvalidEndDate,
			}}
		>
			{children}
		</CalendarContex.Provider>
	);
};

export default CalendarStateProvider;
