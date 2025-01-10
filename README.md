# commerce-seed-catalog

This script is used to seed the content-bus with products. Skus and urlKeys are fetched from either core or live search and then previewed and published.

In order to adhere to the rate limits of the admin api, the script will batch requests sending them 5 at a time and sleep for 2 second between batches.

## Usage

Seed all products
```bash
npm run seed
```

List all products
```bash
npm run seedlist
```

## Configuration

The `site-config.json` file is used to configure the site and the paths to be purged.

```json
{
  "org": "{org}",
  "site": "{site}",
  "confMap": {
    "/us/p/{{urlkey}}": {
      "pageType": "product",
      "storeViewCode": "default",
      "storeCode": "main_website_store"
    }
  }
}
```

The `.env` file is used to configure the environment variables. Rename the `.env.example` file to `.env` and add your configuration.