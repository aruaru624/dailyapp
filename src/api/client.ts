import { createClient } from "@connectrpc/connect";
import { createConnectTransport } from "@connectrpc/connect-web";
import { ActivityService } from "../gen/activity/v1/activity_pb";

const transport = createConnectTransport({
  baseUrl: process.env.NEXT_PUBLIC_API_URL
    ? `${process.env.NEXT_PUBLIC_API_URL}/api`
    : "/api",
});

export const activityClient = createClient(ActivityService, transport);
