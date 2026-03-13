// dateUtils.js - Helper functions for IST timezone

export const formatTimeIST = (timestamp) => {
  if (!timestamp) return 'N/A';
  
  try {
    const date = new Date(timestamp);
    return date.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  } catch (error) {
    return 'Invalid Time';
  }
};
