import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export function formatTimeAgo(dateString: string) {
    try {
        const date = new Date(dateString);
        const diffMs = Date.now() - date.getTime();
        if (isNaN(diffMs)) return "";

        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffDays > 0) return `${diffDays} 天`;
        if (diffHours > 0) return `${diffHours} 小时`;
        if (diffMins > 0) return `${diffMins} 分`;
        return "刚刚";
    } catch {
        return "";
    }
}
