﻿(function () {
    'use strict';

    // 1. Get auth token
    // Ask Teams to get us a token from AAD
    function getClientSideToken() {

        return new Promise((resolve, reject) => {

            display("1. Get auth token from Microsoft Teams");

            microsoftTeams.authentication.getAuthToken({
                successCallback: (result) => {
                    display(result);

                    let decodedToken = jwt_decode(result);

                    display("Now let's use the token's data:", "div");
                    display("name: " + decodedToken.name, "div");
                    display("aadObjectId: " + decodedToken.oid, "div");
                    display("upn: " + decodedToken.upn, "div");
                    display("tenantId: " + decodedToken.tid, "div");

                    display("We can also exchange the token for a server-side 'on-behalf-of' token, in order to call the Graph on the user's behalf:");

                    resolve(result);
                },
                failureCallback: function (error) {
                    reject("Error getting token: " + error);
                }
            });

        });

    }

    // 2. Exchange that token for a token with the required permissions
    //    using the web service (see /auth/token handler in app.js)
    function getServerSideToken(clientSideToken) {

        display("2. Exchange for server-side token");

        return new Promise((resolve, reject) => {

            microsoftTeams.getContext((context) => {

                fetch('/auth/token', {
                    method: 'post',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        'tid': context.tid,
                        'token': clientSideToken
                    }),
                    mode: 'cors',
                    cache: 'default'
                })
                    .then((response) => {
                        if (response.ok) {
                            return response.text();
                        } else {
                            reject(response.error);
                        }
                    })
                    .then((responseJson) => {
                        if (responseJson.error) {
                            reject(responseJson.error);
                        }
                        else if ("unauthorized_client" === responseJson || "invalid_grant" === responseJson) {
                            reject(responseJson);
                        } else {
                            const serverSideToken = responseJson;
                            display(serverSideToken);
                            resolve(serverSideToken);
                        }
                    });
            });
        });
    }

    // 3. Get the server side token and use it to call the Graph API
    function useServerSideToken(data) {

        display("3. Call https://graph.microsoft.com/v1.0/me/ with the server side token");

        return fetch("https://graph.microsoft.com/v1.0/me/",
            {
                method: 'GET',
                headers: {
                    "accept": "application/json",
                    "authorization": "bearer " + data
                },
                mode: 'cors',
                cache: 'default'
            })
            .then((response) => {
                if (response.ok) {
                    return response.json();
                } else {
                    throw (`Error ${response.status}: ${response.statusText}`);
                }
            })
            .then((profile) => {
                display(JSON.stringify(profile, undefined, 4), 'pre');
            });

    }

    // Show the consent pop-up
    function requestConsent() {
        return new Promise((resolve, reject) => {
            microsoftTeams.authentication.authenticate({
                url: window.location.origin + "/auth/authPopup",
                width: 600,
                height: 535,
                successCallback: (result) => {
                    //let data = localStorage.getItem(result);
                    //localStorage.removeItem(result);
                    //resolve(data);
                    resolve(result);
                },
                failureCallback: (reason) => {
                    reject(JSON.stringify(reason));
                }
            });
        });
    }

    // Add text to the display in a <p> or other HTML element
    function display(text, elementTag) {
        var logDiv = document.getElementById('logs');
        var newElement = document.createElement(elementTag ? elementTag : "p");
        newElement.innerText = text;
        logDiv.append(newElement);
        console.log("ssoDemo: " + text);
        return newElement;
    }

    microsoftTeams.initialize();

    // In-line code
    getClientSideToken()
        .then((clientSideToken) => {
            return getServerSideToken(clientSideToken);
        })
        .then((serverSideToken) => {
            return useServerSideToken(serverSideToken);
        })
        .catch((error) => {
            if ("unauthorized_client" === error || "invalid_grant" === error) {
                display(`Error: ${error} - user or admin consent required`);
                // Display in-line button so user can consent
                let button = display("Consent", "button");
                button.onclick = (() => {
                    requestConsent()
                        .then((result) => {
                            // Consent succeeded - use the token we got back
                            let accessToken = result.accessToken;
                            display(`Received access token ${accessToken}`);
                            useServerSideToken(accessToken);
                        })
                        .catch((error) => {
                            display(`ERROR ${error}`);
                            // Consent failed - offer to refresh the page
                            button.disabled = true;
                            let refreshButton = display("Refresh page", "button");
                            refreshButton.onclick = (() => { window.location.reload(); });
                        });
                });
            } else {
                // Something else went wrong
                display(`Error from web service: ${error}`);
            }
        });

    // Use the current user's theme
    microsoftTeams.getContext(function (context) {
        setTheme(context.theme);
    });

    // Handle theme changes
    microsoftTeams.registerOnThemeChangeHandler(function (theme) {
        setTheme(theme);
    });

    // Set the desired theme
    function setTheme(theme) {
        if (theme) {
            document.body.className = 'theme-' + (theme === 'default' ? 'light' : theme);
        }
    }

})();
