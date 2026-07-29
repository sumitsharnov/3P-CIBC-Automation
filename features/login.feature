@login
Feature: Sign On to Online Banking
  As a bank customer
  I want to sign on with my credentials
  So that I can access my accounts

  Background:
    Given I am on the sign-on page

  @smoke
  Scenario: Successful sign-on with valid demo credentials
    When I sign on with username "demo" and password "demo"
    Then I should be redirected to the accounts page

  Scenario: Sign-on fails with invalid credentials
    When I sign on with username "demo" and password "wrongpassword"
    Then I should see the sign-on error message

  Scenario: Sign-on fails with empty credentials
    When I sign on with username "" and password ""
    Then I should see the sign-on error message
