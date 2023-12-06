import { Document, Model } from "mongoose";

interface MonthData {
    month: string;
    count: number;
}

export async function generateLast12MonthsData<T extends Document>(
    model: Model<T>
): Promise<{ last12Months: MonthData[] }> {
    const last12Months: MonthData[] = [];
    // current day 
    const currentDate = new Date();
    // setting  => current day + 1 = tomorrow
    currentDate.setDate(currentDate.getDate() + 1);
    // last 12 month anaylatics 11 to 0 month
    for (let i = 11; i >= 0; i--) {
        // end date 
        const endDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() - i * 28);
        // start day 
        const startDate = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate() - 28);
        // month-year-day
        const monthYear = endDate.toLocaleString("default", {
            day: "numeric",
            month: "short",
            year: "numeric",
        });
        // count for and compare
        const count = await model.countDocuments({
            createdAt: {
                $gte: startDate,
                $lte: endDate,
            },
        });
        last12Months.push({ month: monthYear, count });
    }
    // last 12 month analytics
    return { last12Months }
}









