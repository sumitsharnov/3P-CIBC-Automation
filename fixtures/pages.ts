import { test as base } from 'playwright-bdd';
import { LoginPage } from '../pages/LoginPage';
import { AccountsPage } from '../pages/AccountsPage';
import { LoginBrokenPage } from '../pages/LoginBrokenPage';

/**
 * Page Object fixtures — one instance per test, auto-created against that
 * test's page. This replaces what Cucumber's Hooks.java did manually
 * (constructing Page Objects from a shared driver); Playwright fixtures do
 * the same job declaratively. Driver/context lifecycle and
 * screenshot-on-failure are handled by Playwright itself (see
 * playwright.config.ts `use.screenshot`), not by custom hook code.
 */
type PageFixtures = {
  loginPage: LoginPage;
  accountsPage: AccountsPage;
  loginBrokenPage: LoginBrokenPage;
};

export const test = base.extend<PageFixtures>({
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },
  accountsPage: async ({ page }, use) => {
    await use(new AccountsPage(page));
  },
  loginBrokenPage: async ({ page }, use) => {
    await use(new LoginBrokenPage(page));
  },
});
