# BC PTE Deployment

A Visual Studio Code extension for deploying Business Central apps as PTE (Per-Tenant Extensions) directly from VS Code.

## Features

- Deploy AL apps to Business Central as PTE (Per-Tenant Extensions)
- Uses the existing environment configurations from your launch.json
- Automatically builds your solution before deployment
- Supports multiple environments with easy selection
- Shows deployment progress and status in output channel

## Requirements

- Visual Studio Code 1.60.0 or higher
- AL Language extension
- Access to Business Central with proper permissions
- Azure AD app registration with Business Central API permissions

## Installation

1. Install from the Visual Studio Code Marketplace
2. Or download the .vsix file and install manually

## Setup

The extension uses the authentication information directly from your launch.json file. Make sure your launch.json includes the following credentials for each environment:

```json
{
  "configurations": [
    {
      "type": "al",
      "request": "launch",
      "name": "Your Environment Name",
      "server": "https://your-bc-server",
      "environmentName": "your-environment",
      "tenant": "your-tenant-id",
      "clientID": "your-client-id",
      "clientSecret": "your-client-secret"
      // ... other AL configuration properties
    }
  ]
}
```

## Usage

1. Open your AL project in VS Code
2. Ensure your launch.json file is properly configured with Business Central environments, including the required client ID and client secret
3. Use the following method to deploy:
   - Press Ctrl+Shift+P and search for "BC: Publish as PTE"

4. If you have multiple environments in your launch.json, select the target environment
5. The extension will:
   - Build your solution using the AL Language extension
   - Find the compiled .app file based on your app.json information
   - Upload and deploy it as a PTE to your selected environment
   - Provide status updates in the PTE Deployment output channel

## How It Works

The extension performs the following steps:
1. Validates that you're in an AL project
2. Builds the solution using the AL Language extension
3. Reads environment configurations from your launch.json
4. Authenticates with Business Central using OAuth client credentials
5. Uploads the app to the selected environment
6. Initiates the PTE installation process

## App File Detection

The extension automatically finds your compiled app file using the pattern:
`{publisher}_{name}_{version}.app`

This information is extracted from your app.json file.

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