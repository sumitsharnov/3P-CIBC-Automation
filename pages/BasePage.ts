import type { Page } from '@playwright/test';

/**
 * Shared navigation helper. Page Objects extend this and expose
 * intent-named methods — no raw Playwright calls belong in step definitions.
 */
export abstract class BasePage {
  constructor(protected readonly page: Page) {}

  protected async open(path: string): Promise<void> {
    await this.page.goto(path);
  }

  currentUrl(): string {
    return this.page.url();
  }
}
