const GOOGLE_CALENDAR_PATH =
  "/api/integrations/v1/google/calendar/events";

export function createCrmCalendarApi(client) {
  async function syncEvent(payload) {
    return client.request(GOOGLE_CALENDAR_PATH, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async function createEvent({
    userProfileId,
    summary,
    description,
    location,
    start,
    end,
  }) {
    return syncEvent({
      action: "CREATE",
      userProfileId,
      summary,
      description,
      location,
      start,
      end,
    });
  }

  async function updateEvent({
    userProfileId,
    googleEventId,
    summary,
    description,
    location,
    start,
    end,
  }) {
    return syncEvent({
      action: "UPDATE",
      userProfileId,
      googleEventId,
      summary,
      description,
      location,
      start,
      end,
    });
  }

  async function deleteEvent({
    userProfileId,
    googleEventId,
  }) {
    return syncEvent({
      action: "DELETE",
      userProfileId,
      googleEventId,
    });
  }

  return {
    syncEvent,
    createEvent,
    updateEvent,
    deleteEvent,
  };
}