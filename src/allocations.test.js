import {
	ALLOCATION_PAGE_SIZE,
	AllocationLoadError,
	allocationToCalendarEvent,
	createAllocationLoader,
	fetchJobAllocations,
	toBlockedRanges,
} from "./allocations";

const blocked = {
	id: "2199",
	Type: "Blocked",
	Projects: { id: "p1", name: "TEST Project" },
	Project_Name: "Blocked Project",
	Contractor: { id: "c403", name: "Contr - 403" },
	Start_Date: "2026-11-16",
	End_Date: "2026-11-18",
	Color_Code: "#999",
};
const attendance = {
	id: "3001",
	Type: "Attendance",
	Projects: { id: "p2", name: "Kitchen Reno" },
	Contractor: { id: "c1" },
	Start_Date: "2026-11-30",
	End_Date: "2026-12-03",
	Job_Number: "J-77",
};

const zohoWith = (...responses) => {
	const coql = jest.fn();
	responses.forEach((r) =>
		r instanceof Error ? coql.mockRejectedValueOnce(r) : coql.mockResolvedValueOnce(r)
	);
	return { zoho: { CRM: { API: { coql } } }, coql };
};

const makeRows = (n, prefix = "r") =>
	Array.from({ length: n }, (_, i) => ({ id: `${prefix}${i}`, Projects: { id: "p" } }));

describe("fetchJobAllocations", () => {
	test("returns rows and queries the overlapping range", async () => {
		const { zoho, coql } = zohoWith({ data: [blocked, attendance], info: { more_records: false } });
		const rows = await fetchJobAllocations(zoho, "2026-11-01", "2026-11-30");
		expect(rows).toEqual([blocked, attendance]);
		const q = coql.mock.calls[0][0].select_query;
		expect(q).toContain("Start_Date <= '2026-11-30'");
		expect(q).toContain("End_Date >= '2026-11-01'");
		expect(q).toContain(`limit 0, ${ALLOCATION_PAGE_SIZE}`);
		expect(ALLOCATION_PAGE_SIZE).toBeLessThanOrEqual(200);
	});

	test("paginates until a short page", async () => {
		const { zoho, coql } = zohoWith(
			{ data: makeRows(200, "a"), info: { more_records: true } },
			{ data: makeRows(200, "b"), info: { more_records: true } },
			{ data: makeRows(3, "c"), info: { more_records: false } }
		);
		const rows = await fetchJobAllocations(zoho, "2026-11-01", "2026-11-30");
		expect(rows).toHaveLength(403);
		expect(coql.mock.calls.map((c) => /limit (\d+),/.exec(c[0].select_query)[1])).toEqual([
			"0",
			"200",
			"400",
		]);
	});

	test("empty response (204) is an empty success", async () => {
		const { zoho } = zohoWith(undefined);
		expect(await fetchJobAllocations(zoho, "2026-11-01", "2026-11-30")).toEqual([]);
	});

	test("rejected call and error payloads are failures, not empty results", async () => {
		await expect(
			fetchJobAllocations(zohoWith(new Error("network")).zoho, "2026-11-01", "2026-11-30")
		).rejects.toBeInstanceOf(AllocationLoadError);
		await expect(
			fetchJobAllocations(
				zohoWith({ code: "INVALID_QUERY", message: "limit too large" }).zoho,
				"2026-11-01",
				"2026-11-30"
			)
		).rejects.toThrow(/limit too large/);
	});

	test("failure on a later page fails the whole fetch", async () => {
		const { zoho } = zohoWith(
			{ data: makeRows(200), info: { more_records: true } },
			new Error("boom")
		);
		await expect(fetchJobAllocations(zoho, "2026-11-01", "2026-11-30")).rejects.toThrow(/boom/);
	});
});

describe("createAllocationLoader", () => {
	test("initial load, refresh from cache, and no duplicates", async () => {
		const fetchRange = jest.fn().mockResolvedValue([blocked, attendance]);
		const loader = createAllocationLoader(fetchRange);
		await loader.load("2026-11-01", "2026-11-30");
		expect(fetchRange).toHaveBeenCalledWith("2026-11-01", "2026-11-30", undefined);

		// Revisiting the same month does not refetch.
		expect(await loader.load("2026-11-10", "2026-11-20")).toEqual({ fetched: false });
		expect(fetchRange).toHaveBeenCalledTimes(1);

		// A new load of an adjacent month returning an overlapping record does not duplicate it.
		await loader.load("2026-12-01", "2026-12-31");
		expect(fetchRange).toHaveBeenLastCalledWith("2026-12-01", "2026-12-31", undefined);
		expect(loader.getAll().map((a) => a.id).sort()).toEqual(["2199", "3001"]);
	});

	test("fetches only missing months as one contiguous run", async () => {
		const fetchRange = jest.fn().mockResolvedValue([]);
		const loader = createAllocationLoader(fetchRange);
		await loader.load("2026-11-01", "2026-11-30");
		await loader.load("2026-11-15", "2027-01-20");
		expect(fetchRange).toHaveBeenLastCalledWith("2026-12-01", "2027-01-31", undefined);
	});

	test("an error leaves the month unloaded and a retry succeeds", async () => {
		const fetchRange = jest
			.fn()
			.mockRejectedValueOnce(new AllocationLoadError("down"))
			.mockResolvedValueOnce([blocked]);
		const loader = createAllocationLoader(fetchRange);
		await expect(loader.load("2026-11-01", "2026-11-30")).rejects.toThrow("down");
		expect(loader.getAll()).toEqual([]);
		await loader.load("2026-11-01", "2026-11-30");
		expect(fetchRange).toHaveBeenCalledTimes(2);
		expect(loader.getAll()).toEqual([blocked]);
	});

	test("a locally created allocation is replaced, not duplicated, by the reloaded record", async () => {
		const loader = createAllocationLoader(jest.fn().mockResolvedValue([blocked]));
		loader.add({ ...blocked, Type: undefined });
		await loader.load("2026-11-01", "2026-11-30");
		expect(loader.getAll()).toHaveLength(1);
		expect(loader.getAll()[0].Type).toBe("Blocked");
	});
});

describe("allocationToCalendarEvent", () => {
	test("maps a blocked allocation to the right contractor and dates", () => {
		const ev = allocationToCalendarEvent(blocked);
		expect(ev).toMatchObject({
			resource: "c403",
			start: "2026-11-16",
			end: "2026-11-18",
			title: "TEST Project",
			project_id: "p1",
			allocation_type: "Blocked",
			event_id: "2199",
		});
		expect(ev.cssClass).toContain("--blocked");
	});

	test("maps an attendance allocation crossing a month boundary with job number", () => {
		const ev = allocationToCalendarEvent(attendance);
		expect(ev).toMatchObject({
			start: "2026-11-30",
			end: "2026-12-03",
			job_number: "J-77",
			allocation_type: "Attendance",
		});
		expect(ev.cssClass).not.toContain("--blocked");
	});

	test("COQL lookup without a name still gets a visible label", () => {
		expect(
			allocationToCalendarEvent({ ...blocked, Projects: { id: "p1" } }).title
		).toBe("Blocked Project");
		expect(
			allocationToCalendarEvent({ ...attendance, Projects: { id: "p2" }, Project_Name: "Kitchen" }).title
		).toBe("Kitchen");
	});

	test("single-day / inclusive-end records are widened to one day so they render", () => {
		const same = allocationToCalendarEvent({ ...attendance, Start_Date: "2026-11-16", End_Date: "2026-11-16" });
		expect(same.end).toBe("2026-11-17");
		const missingEnd = allocationToCalendarEvent({ ...attendance, Start_Date: "2026-11-30", End_Date: null });
		expect(missingEnd.end).toBe("2026-12-01");
	});

	test("records without a project lookup are skipped", () => {
		expect(allocationToCalendarEvent({ ...blocked, Projects: null })).toBeNull();
	});

	test("blocked ranges come only from blocked allocations", () => {
		expect(toBlockedRanges([blocked, attendance])).toEqual([
			{ resource: "c403", start: "2026-11-16", end: "2026-11-18" },
		]);
	});
});
