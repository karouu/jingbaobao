# Architecture

## Project Overview

JingJiaBao (京价保) is a browser extension designed to automatically monitor product prices on JD.com (京东) and apply for price protection on behalf of the user. This extension helps users get refunds when the price of a product they purchased drops within the price protection period.

**Note:** The project is no longer actively maintained.

## Technology Stack

The project is built using the following technologies:

- **Frontend Framework:** Vue.js 2.x
- **Build Tool:** Webpack 4
- **Package Manager:** Yarn
- **Database:** Dexie.js (a wrapper for IndexedDB) for client-side storage.
- **UI Components:** weui and weui.js
- **Charting Library:** @antv/g2 for price history charts.
- **Core Libraries:**
  - jQuery
  - lodash for utility functions.
  - luxon for date and time manipulation.
- **Development Dependencies:**
  - Babel for JavaScript transpilation.
  - less-loader for compiling LESS to CSS.
  - vue-loader and vue-template-compiler for handling Vue components.

## Directory Structure

The repository is organized as follows:

- **`/public`**: Contains the `manifest.json` file, which is the entry point for the browser extension, defining its properties, permissions, and scripts.
- **`/src`**: The main source code directory.
  - **`/src/components`**: Contains reusable Vue.js components that make up the user interface of the extension's popup and other pages.
- **`/static`**: Contains static assets like images and icons used in the extension.

## Core Components

The extension is composed of the following core scripts:

- **`background.js`**: The background script acts as the central event handler for the extension. It runs in the background, independent of any web page, and manages the extension's state, handles alarms for periodic tasks (like checking prices), and orchestrates communication between different parts of the extension.
- **`content_script.js`**: This script is injected into the context of web pages (specifically, JD.com pages). It has access to the DOM of the page and is used to extract information, such as order details and product prices, and to automate actions, like submitting price protection requests.
- **`popup.js`**: This script powers the extension's popup user interface, which is displayed when the user clicks the extension icon in the browser toolbar. It is responsible for rendering the UI (using Vue.js components) and handling user interactions.

## Data Management

The extension uses IndexedDB for persistent client-side storage of user data, such as order history and price protection status. Data management is handled through the following:

- **`db.js`**: This file defines the database schema and initializes the database using Dexie.js. Dexie.js is a minimalist wrapper for IndexedDB that simplifies database operations.
- **`Dexie.js`**: By using Dexie.js, the extension can easily perform CRUD (Create, Read, Update, Delete) operations on the IndexedDB database, making it easier to manage complex data structures without writing a lot of boilerplate code.

## Build Process

The extension is built and bundled using Webpack. The configuration for the build process is defined in `webpack.config.js`. The main scripts for building the extension are located in `package.json`:

-   **`yarn dev`**: This command starts Webpack in watch mode, which automatically recompiles the extension when a file is changed. This is used for development.
-   **`yarn build`**: This command creates a production-ready build of the extension. It sets `NODE_ENV` to `production` and runs the `start` script. The resulting files are typically placed in a `dist` or `build` directory (though the exact output is configured in `webpack.config.js`), ready to be loaded into a browser.
-   **`yarn start`**: This is the core Webpack build command.

The build process involves:
-   Transpiling modern JavaScript (ES6+) to a more widely compatible version using Babel.
-   Loading and bundling Vue.js single-file components (`.vue` files).
-   Processing CSS and LESS files.
-   Copying static assets to the output directory.
