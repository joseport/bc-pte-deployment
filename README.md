# BC PTE Deployment

A Visual Studio Code extension for deploying Business Central apps as PTE (Per-Tenant Extensions) directly from VS Code.

## Features

- Deploy AL apps to Business Central as PTE
- Uses the same environment configurations from your launch.json
- Automatically builds your solution before deployment
- Supports multiple environments with easy selection

## Requirements

- Visual Studio Code 1.60.0 or higher
- AL Language extension
- Access to Business Central with proper permissions

## Installation

1. Install from the Visual Studio Code Marketplace
2. Or download the .vsix file and install manually

## Setup

Before using the extension, you need to configure your Business Central authentication:

1. Open VS Code settings (File > Preferences > Settings)
2. Search for "BC PTE Deployment"
3. Fill in the following details:
   - **Tenant ID**: Your Azure AD tenant ID
   - **Client ID**: App registration client ID with Business Central permissions
   - **Client Secret**: App registration client secret

## Usage

1. Open your AL project in VS Code
2. Ensure your launch.json file is properly configured with Business Central environments
3. Use one of the following methods to deploy:
   - Right-click in an AL file and select "BC: Publish as PTE (Per-Tenant Extension)" 
   - Right-click on a file in the Explorer and select "BC: Publish as PTE (Per-Tenant Extension)"
   - Press Ctrl+Shift+P and search for "BC: Publish as PTE"

4. If you have multiple environments in your launch.json, select the target environment
5. The extension will:
   - Build your solution
   - Find the compiled .app file
   - Upload and deploy it as a PTE to your selected environment

## Extension Settings

This extension contributes the following settings:

* `bcPteDeployment.tenantId`: Your Azure AD tenant ID
* `bcPteDeployment.clientId`: Business Central OAuth Client ID
* `bcPteDeployment.clientSecret`: Business Central OAuth Client Secret
* `bcPteDeployment.scope`: OAuth scope for Business Central API (default: "https://api.businesscentral.dynamics.com/.default")

## Differences from AL Language Extension

The standard AL Language extension's "Publish" functionality deploys extensions as development extensions, which have limitations:

1. Development extensions are intended for development and testing only
2. They cannot be used in production environments
3. They have limited accessibility for regular users

This extension deploys your apps as Per-Tenant Extensions (PTE), which:

1. Can be used in production environments
2. Are accessible to all users with appropriate permissions
3. Have better performance and stability characteristics
4. Follow the proper extension deployment lifecycle

## License

This extension is licensed under the MIT License.