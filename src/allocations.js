import moment from "moment";

// Zoho COQL returns at most 200 rows per query; larger limits are rejected.
export const ALLOCATION_PAGE_SIZE = 200;

export class AllocationLoadError extends Error {}

function describeFailure(response) {
	return (
		response?.message ||
		response?.code ||
		response?.data?.[0]?.message ||
		"unexpected response"
	);
}

// Fetches every Job_Allocation overlapping [startDate, endDate] (inclusive),
// following COQL pagination. Throws AllocationLoadError on any failed page so
// a failure is never mistaken for an empty calendar.
export async function fetchJobAllocations(
	zoho,
	startDate,
	endDate,
	onProgress = () => {}
) {
	const allocations = [];
	let offset = 0;

	for (;;) {
		let response;
		try {
			response = await zoho.CRM.API.coql({
				select_query:
					"select id,Start_Date,End_Date,Projects,Projects.Job_Number as Job_Number,Contractor," +
					"Color_Code,Project_Name,Project_Summary,Current_Estimated_Time_Budget," +
					`Excluded_Dates,Type from Job_Allocations where ((Start_Date <= '${endDate}') and (End_Date >= '${startDate}')) ` +
					`order by Start_Date asc limit ${offset}, ${ALLOCATION_PAGE_SIZE}`,
			});
		} catch (error) {
			throw new AllocationLoadError(
				`Could not load allocations: ${error?.message || error}`
			);
		}

		// Zoho answers 204 / no body when nothing matches; anything else that is
		// not a data array (e.g. {code: "INVALID_QUERY"}) is a failure.
		if (response?.data !== undefined && !Array.isArray(response.data)) {
			throw new AllocationLoadError(
				`Could not load allocations: ${describeFailure(response)}`
			);
		}
		if (response?.data === undefined && response?.code) {
			throw new AllocationLoadError(
				`Could not load allocations: ${describeFailure(response)}`
			);
		}

		const page = response?.data || [];
		allocations.push(...page);
		onProgress(allocations.length);

		const more =
			page.length === ALLOCATION_PAGE_SIZE && response?.info?.more_records !== false;
		if (!more) break;
		offset += ALLOCATION_PAGE_SIZE;
	}

	return allocations;
}

const monthKey = (m) => m.format("YYYY-MM");

// Caches allocations by id and remembers which whole months were fetched
// successfully. A failed month is never marked as fetched, so it is retried.
export function createAllocationLoader(fetchRange) {
	const cache = new Map();
	const fetchedMonths = new Set();
	const inFlightMonths = new Set();

	async function load(start, end, onProgress) {
		const missing = [];
		const cursor = moment(start, "YYYY-MM-DD").startOf("month");
		const last = moment(end, "YYYY-MM-DD").startOf("month");
		while (cursor.isSameOrBefore(last)) {
			const key = monthKey(cursor);
			if (!fetchedMonths.has(key) && !inFlightMonths.has(key)) {
				missing.push(cursor.clone());
			}
			cursor.add(1, "month");
		}
		if (missing.length === 0) return { fetched: false };

		const runs = [];
		missing.forEach((m) => {
			const run = runs[runs.length - 1];
			if (run && run[run.length - 1].clone().add(1, "month").isSame(m)) {
				run.push(m);
			} else {
				runs.push([m]);
			}
		});

		const outcomes = await Promise.allSettled(
			runs.map(async (run) => {
				const keys = run.map(monthKey);
				const runStart = run[0].format("YYYY-MM-DD");
				const runEnd = run[run.length - 1]
					.clone()
					.endOf("month")
					.format("YYYY-MM-DD");
				keys.forEach((k) => inFlightMonths.add(k));
				try {
					const rows = await fetchRange(runStart, runEnd, onProgress);
					rows.forEach((row) => {
						if (row?.id) cache.set(row.id, row);
					});
					keys.forEach((k) => fetchedMonths.add(k));
				} finally {
					keys.forEach((k) => inFlightMonths.delete(k));
				}
			})
		);

		const failure = outcomes.find((o) => o.status === "rejected");
		if (failure) throw failure.reason;
		return { fetched: true };
	}

	return {
		load,
		add: (allocation) => {
			if (allocation?.id) cache.set(allocation.id, allocation);
		},
		getAll: () => [...cache.values()],
	};
}

export function getAllocationJobNumber(allocation) {
	return (
		allocation?.job_number ||
		allocation?.Job_Number ||
		allocation?.["Projects.Job_Number"] ||
		allocation?.Projects?.Job_Number ||
		""
	);
}

// Converts a CRM allocation into a calendar event. Records are never dropped
// for a missing project name, and zero/negative-length ranges (a one-day
// allocation whose End_Date equals its Start_Date) are widened to one day so
// they still render.
export function allocationToCalendarEvent(event) {
	if (!event?.Projects?.id) return null;

	const start = moment(event.Start_Date).format("YYYY-MM-DD");
	let end = moment(event.End_Date).format("YYYY-MM-DD");
	if (!event.End_Date || end <= start) {
		end = moment(start).add(1, "day").format("YYYY-MM-DD");
	}

	const isBlocked = event.Type === "Blocked";
	return {
		start: event.Start_Date,
		end,
		title:
			event.Projects.name ||
			event.Project_Name ||
			(isBlocked ? "Blocked Project" : "Project"),
		resource: event?.Contractor?.id,
		event_id: event?.id,
		color: event.Color_Code,
		project_id: event?.Projects?.id,
		job_number: getAllocationJobNumber(event),
		Project_Summary: event.Project_Summary || event.Scope_Of_Work || "",
		estimated_time_budget: event.Current_Estimated_Time_Budget || 0,
		Excluded_Dates: event.Excluded_Dates,
		allocation_type: event.Type || "Attendance",
		cssClass: isBlocked
			? "worksboard-calendar-event worksboard-calendar-event--blocked"
			: "worksboard-calendar-event",
	};
}

export function toBlockedRanges(allocations) {
	return allocations
		.filter((event) => event.Type === "Blocked")
		.map((event) => ({
			resource: event?.Contractor?.id,
			start: event?.Start_Date,
			end: event?.End_Date,
		}));
}
