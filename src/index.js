/*
 * Copyright 2024 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */
import fs from 'fs';
import fetchProductsCore from './queries/core.js';
import fetchProductsLiveSearch from './queries/live-search.js';
import {
  createBulkJob, getPreviewPublishPaths,
} from './utils/admin.js';

const USE_LIVE_SEARCH = true;
const SHOULD_PUBLISH = true;

/**
 * Fetches a batch of products from the API.
 * @param {number} pageSize The number of products to fetch per page.
 * @param {number} currentPage The current page number.
 * @returns {Promise<Object>} The products data.
 */
async function fetchProductBatch(pageSize, currentPage) {
  try {
    const response = USE_LIVE_SEARCH ? await fetchProductsLiveSearch(pageSize, currentPage) : await fetchProductsCore(pageSize, currentPage);

    if (!response.ok) {
      console.error(`Network response was not ok: ${response.status} ${response.statusText}`);
      return null;
    }

    const responseData = await response.json();

    if (responseData.errors) {
      console.error('GraphQL Errors:', responseData.errors);
      return null;
    }

    let productsData = USE_LIVE_SEARCH
      ? responseData.data.productSearch
      : responseData.data.products;

    if (USE_LIVE_SEARCH) {
      productsData = {
        ...productsData,
        items: productsData.items.map((item) => item.productView),
      };
    }

    return productsData;
  } catch (error) {
    console.error(`Error fetching page ${currentPage}:`, error.message);
    return null;
  }
}

/**
 * Writes the results to a file.
 * @param {Object} results The results to write to the file.
 * @param {string} fileName The name of the file to write the results to.
 */
function writeResults(results, fileName) {
  fs.writeFileSync(fileName, JSON.stringify(results, null, 2), 'utf8');
}

/**
 * Lists all products.
 * @returns {Promise<Object>} The products data.
 */
async function listAllProducts(startTime) {
  const results = [];
  let currentPage = 1;
  let totalPages = 2;

  while (currentPage <= totalPages) {
    console.log(`Fetching page ${currentPage} of ${totalPages}...`);

    const productsData = await fetchProductBatch(500, currentPage);
    results.push(...productsData.items);

    totalPages = productsData.page_info.total_pages;
    currentPage += 1;
  }

  writeResults(results, `all-products-${startTime}.json`);

  console.log('Data successfully written to output.txt');
  return results;
}

/**
 * Seeds all products.
 */
async function seedAllProducts() {
  if (!process.env.HELIX_ADMIN_API_KEY) {
    console.error('HELIX_ADMIN_API_KEY is not set');
    return;
  }

  const startTime = Date.now();

  const siteConfig = JSON.parse(fs.readFileSync('site-config.json', 'utf8'));

  const allProducts = await listAllProducts(startTime);
  const productList = allProducts.map((product) => getPreviewPublishPaths(siteConfig, product.sku, product.urlKey)[0])
    .filter((path) => path !== undefined && path.startsWith('/'));

  const previewJob = await createBulkJob(siteConfig, 'preview', productList);

  writeResults(previewJob, `bulk-preview-result-${startTime}.json`);

  const failedPreviews = previewJob.data.resources.filter((result) => result.status !== 200);
  if (failedPreviews.length > 0) {
    writeResults(failedPreviews, `bulk-preview-failed-${startTime}.json`);
    writeResults(failedPreviews.map((result) => result.path), `bulk-preview-failed-list-${startTime}.json`);
  }

  if (SHOULD_PUBLISH) {
    const successfulPreviewPaths = previewJob.data.resources.filter((result) => result.status === 200).map((result) => result.path);
    const liveJob = await createBulkJob(siteConfig, 'live', successfulPreviewPaths);

    writeResults(liveJob, `bulk-publish-result-${startTime}.json`);

    const failedPublishes = liveJob.data.resources.filter((result) => result.status !== 200);
    if (failedPublishes.length > 0) {
      writeResults(failedPublishes, `bulk-publish-failed-${startTime}.json`);
      writeResults(failedPublishes.map((result) => result.path), `bulk-publish-failed-list-${startTime}.json`);
    }
  }

  const endTime = Date.now();
  const elapsedTime = endTime - startTime; // milliseconds

  const minutes = Math.floor(elapsedTime / 60000);
  const seconds = Math.floor((elapsedTime % 60000) / 1000);

  console.log(`Execution time: ${minutes} minute(s) and ${seconds} second(s).`);
}

const arg = process.argv[2];

if (arg === 'list') {
  listAllProducts();
} else {
  seedAllProducts();
}
