export const K = {
  user: (id: string) => `wj:user:${id}`,
  userEmail: (email: string) => `wj:idx:user:email:${email}`,
  devicePk: (id: string) => `wj:device:pk:${id}`,
  deviceDid: (deviceId: string) => `wj:device:did:${deviceId}`,
  devicesOfUser: (userId: string) => `wj:idx:devices:u:${userId}`,
  diary: (id: string) => `wj:diary:${id}`,
  diaryScope: (scopeKey: string) => `wj:idx:diary:scope:${scopeKey}`,
  diaryMonth: (scopeKey: string, yyyyMm: string) => `wj:idx:diary:month:${scopeKey}:${yyyyMm}`,
  diaryMut: (deviceId: string, mut: string) => `wj:idx:diary:mut:${deviceId}:${mut}`,
  emotionDictData: () => `wj:emotion:dict:data`,
  weatherSnap: (id: string) => `wj:weather:snap:${id}`,
  weatherSnapIdx: (location: string, dateKey: string) => `wj:idx:weather:${location}:${dateKey}`,
  syncQ: (id: string) => `wj:syncq:${id}`,
  syncQPending: () => `wj:idx:syncq:pending`,
};

export function diaryScopeKey(userId: string | null, deviceId: string): string {
  if (userId) {
    return `u:${userId}`;
  }
  return `a:${deviceId}`;
}
