import { createBdd } from 'playwright-bdd';
import { test } from '../fixtures/pages';

const { Given, When, Then } = createBdd(test);

Given('I am on the sign-on page', async ({ loginPage }) => {
  await loginPage.goto();
});

When(
  'I sign on with username {string} and password {string}',
  async ({ loginPage }, username: string, password: string) => {
    await loginPage.signOn(username, password);
  },
);

Then('I should be redirected to the accounts page', async ({ accountsPage }) => {
  await accountsPage.expectDisplayed();
});

Then('I should see the sign-on error message', async ({ loginPage }) => {
  await loginPage.expectErrorVisible();
});
