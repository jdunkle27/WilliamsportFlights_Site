# Williamsportflights

This project was generated with [Angular CLI](https://github.com/angular/angular-cli) version 17.3.17.

## Development server

Run `ng serve` for a dev server. Navigate to `http://localhost:4200/`. The application will automatically reload if you change any of the source files.

## Code scaffolding

Run `ng generate component component-name` to generate a new component. You can also use `ng generate directive|pipe|service|class|guard|interface|enum|module`.

## Build

Run `ng build` to build the project. The build artifacts will be stored in the `dist/` directory.

## Live aircraft feed

The dashboard polls `GET /aircraft` every five seconds. In production, the Express SSR server forwards that same-origin request to the ADS-B FastAPI service at `http://127.0.0.1:8000/aircraft`, keeping the tracker private on the shared host. Set `ADSB_API_URL` on the site server to override that upstream URL.

For local development, `ng serve` uses `proxy.conf.json` to forward `/aircraft` directly to the same FastAPI endpoint. Start the ADS-B API and receiver services from the `WilliamsportFlights_ADS-B_Tracker` repository first.

For production, build with `npm run build` and run the SSR server with `npm run serve:ssr:williamsportflights`.

## Running unit tests

Run `ng test` to execute the unit tests via [Karma](https://karma-runner.github.io).

## Running end-to-end tests

Run `ng e2e` to execute the end-to-end tests via a platform of your choice. To use this command, you need to first add a package that implements end-to-end testing capabilities.

## Further help

To get more help on the Angular CLI use `ng help` or go check out the [Angular CLI Overview and Command Reference](https://angular.io/cli) page.
