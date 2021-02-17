if (Cypress.env('API') !== 'guillotina') {
  describe('User Control Panel Test', () => {
    beforeEach(() => {
      // given a logged in editor
      // and a folder that contains a document
      // and the folder contents view
      cy.visit('/');
      cy.autologin();
      cy.visit('/controlpanel/users');
      cy.waitForResourceToLoad('@navigation');
      cy.waitForResourceToLoad('@breadcrumbs');
      cy.waitForResourceToLoad('@actions');
      cy.waitForResourceToLoad('@types');
    });

    it('Should add User to controlPanel', () => {
      // when I added a user from controlPanel
      cy.get('.addSVG').click();
      cy.get('input[id="field-username"]').clear().type('iFlameing');
      cy.get('input[id="field-fullname"]').clear().type('Alok Kumar');
      cy.get('input[id ="field-email"]').clear().type('info@example.com');
      cy.get('input[id="field-password"]').clear().type('test@test');
      cy.get('button[title="Save"]').focus().click();

      // then the user section must contains a fullname when I searched the
      // same with the same username
      cy.get('input[id="user-search-input"]').clear().type('i');
      cy.get('.icon.button:first').click();
      cy.get('.fullname').should('have.text', 'Alok Kumar');
    });
  });
}
