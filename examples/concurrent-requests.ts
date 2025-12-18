/**
 * Concurrent requests example
 * 
 * This example demonstrates how the library handles multiple concurrent
 * identical requests - only one is executed and others wait for the result
 */

import axios from 'axios';
import { createIdempotentAxios } from '../dist/index';

const client = createIdempotentAxios(axios.create({
  baseURL: 'https://jsonplaceholder.typicode.com',
}), {
  ttl: 300,
  backend: 'memory',
  idempotency: {
    methods: ['POST'],
    include: {
      path: true,
      body: true,
    },
  },
});

async function main() {
  console.log('=== Concurrent Requests Example ===\n');

  try {
    console.log('Firing 5 identical POST requests concurrently...\n');

    const startTime = Date.now();

    // Fire 5 identical requests concurrently
    const promises = Array.from({ length: 5 }, (_, i) =>
      client.post('/posts', {
        title: 'Concurrent Post',
        body: 'This should only be sent once',
        userId: 1,
      }).then(response => {
        const elapsed = Date.now() - startTime;
        console.log(`Request ${i + 1}: Status ${response.status}, ID: ${response.data.id}, Time: ${elapsed}ms`);
        return response;
      })
    );

    await Promise.all(promises);

    const totalTime = Date.now() - startTime;
    console.log(`\nAll requests completed in ${totalTime}ms`);
    console.log('✅ Only one actual HTTP request was made!');

    // Wait a bit and try again
    console.log('\n--- Waiting 2 seconds ---\n');
    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log('Making the same request again (should use cache)...');
    const cachedResponse = await client.post('/posts', {
      title: 'Concurrent Post',
      body: 'This should only be sent once',
      userId: 1,
    });
    console.log(`Cached response: Status ${cachedResponse.status}, ID: ${cachedResponse.data.id}`);
    console.log('✅ Response served from cache!');

  } catch (error: any) {
    console.error('❌ Error:', error.message);
  }
}

main();
