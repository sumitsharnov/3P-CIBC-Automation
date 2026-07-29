package com.pillar.bankqa.stepdefinitions;

import com.pillar.bankqa.pages.AccountsPage;
import com.pillar.bankqa.pages.LoginPage;
import com.pillar.bankqa.utils.DriverFactory;
import io.cucumber.java.en.Given;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;

import static org.testng.Assert.assertTrue;

/**
 * Thin: delegates every interaction to Page Objects and asserts on their
 * outcomes. No Selenium calls belong here.
 */
public class LoginSteps {

    private final LoginPage loginPage = new LoginPage(DriverFactory.getDriver());
    private final AccountsPage accountsPage = new AccountsPage(DriverFactory.getDriver());

    @Given("I am on the sign-on page")
    public void iAmOnTheSignOnPage() {
        loginPage.navigateTo();
    }

    @Given("I am on the broken sign-on page")
    public void iAmOnTheBrokenSignOnPage() {
        loginPage.navigateToBroken();
    }

    @When("I sign on with username {string} and password {string}")
    public void iSignOnWithUsernameAndPassword(String username, String password) {
        loginPage.signOn(username, password);
    }

    @Then("I should be redirected to the accounts page")
    public void iShouldBeRedirectedToTheAccountsPage() {
        assertTrue(accountsPage.isDisplayed(),
                "Expected URL to contain /accounts but was: " + loginPage.currentUrl());
    }

    @Then("I should see the sign-on error message")
    public void iShouldSeeTheSignOnErrorMessage() {
        assertTrue(loginPage.isErrorMessageDisplayed(), "Expected a sign-on error message to be displayed");
    }
}
