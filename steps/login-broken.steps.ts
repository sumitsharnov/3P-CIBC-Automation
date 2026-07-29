import { createBdd } from 'playwright-bdd';
import { test } from '../fixtures/pages';

const { Given, When, Then } = createBdd(test);

Given('I am on the broken sign-on demo page', async ({ loginBrokenPage }) => {
  await loginBrokenPage.goto();
});

When(
  'I attempt the broken sign-on with username {string} and password {string}',
  async ({ loginBrokenPage }, username: string, password: string) => {
    await loginBrokenPage.signOn(username, password);
  },
);

Then('I should see a service outage error', async ({ loginBrokenPage }) => {
  await loginBrokenPage.expectServiceOutageError();
});
