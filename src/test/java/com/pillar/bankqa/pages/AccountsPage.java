package com.pillar.bankqa.pages;

import org.openqa.selenium.WebDriver;

public class AccountsPage extends BasePage {

    public AccountsPage(WebDriver driver) {
        super(driver);
    }

    public boolean isDisplayed() {
        return currentUrl().contains("/accounts");
    }
}
