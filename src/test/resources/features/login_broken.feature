@login-broken
Feature: Broken Sign-On Demo Page
  Simulated-defect page used to prove the framework correctly reports a
  failing test — not a real production flow.

  Scenario: Sign-on fails even with correct demo credentials (known defect)
    Given I am on the broken sign-on page
    When I sign on with username "demo" and password "demo"
    Then I should be redirected to the accounts page
