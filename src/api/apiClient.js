import axios from 'axios';

// A simple queue with a delay to manage API requests
const requestQueue = [];
let isProcessing = false;

async function processQueue() {
  if (isProcessing || requestQueue.length === 0) {
    return;
  }
  isProcessing = true;

  const { request, resolve, reject } = requestQueue.shift();

  try {
    const response = await request();
    resolve(response);
  } catch (error) {
    // If we get a 429 (Too Many Requests) or 418 (IP Banned), wait and retry once.
    if (error.response && (error.response.status === 429 || error.response.status === 418)) {
      console.warn(`Rate limit hit. Waiting 60 seconds before retrying...`);
      await new Promise(r => setTimeout(r, 60000));
      try {
        const response = await request();
        resolve(response);
      } catch (retryError) {
        reject(retryError);
      }
    } else {
      reject(error);
    }
  }

  // Wait a short time between requests to be safe
  await new Promise(r => setTimeout(r, 250)); // 250ms delay between requests
  isProcessing = false;
  processQueue();
}

// The public API client that adds requests to the queue
const apiClient = {
  get: (url, config) => {
    return new Promise((resolve, reject) => {
      requestQueue.push({ request: () => axios.get(url, config), resolve, reject });
      processQueue();
    });
  },
  post: (url, data, config) => {
    return new Promise((resolve, reject) => {
      requestQueue.push({ request: () => axios.post(url, data, config), resolve, reject });
      processQueue();
    });
  },
  delete: (url, config) => {
    return new Promise((resolve, reject) => {
      requestQueue.push({ request: () => axios.delete(url, config), resolve, reject });
      processQueue();
    });
  },
};

export default apiClient;
