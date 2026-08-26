export const REFRESH_MS=60000;

export function emptySnapshot(updatedAt=new Date().toISOString()){
  return {
    updatedAt,
    market:{instruments:[],sourceHealth:{}},
    news:[],
    niftyInNews:[],
    events:[],
    impact:{eventTypes:{}},
    surprises:{events:{}},
    alerts:{sent:{}},
    sourceStatus:{sources:{}}
  };
}

export async function refreshSnapshot(fetchImpl=fetch,now=new Date()){
  void fetchImpl;
  return emptySnapshot(now.toISOString());
}
