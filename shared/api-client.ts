import axios from "axios";
import type {
  HealthResponse,
  IngestEventsRequest,
  IngestEventsResponse
} from "./types";

export async function postEvents(
  baseUrl: string,
  payload: IngestEventsRequest
): Promise<IngestEventsResponse> {
  const response = await axios.post<IngestEventsResponse>(
    `${baseUrl}/api/v1/events`,
    payload,
    {
      headers: {
        "content-type": "application/json"
      }
    }
  );

  return response.data;
}

export async function getHealth(baseUrl: string): Promise<HealthResponse> {
  const response = await axios.get<HealthResponse>(`${baseUrl}/api/v1/health`);
  return response.data;
}
