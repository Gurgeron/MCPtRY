# Changelog

All notable changes to the Google Docs MCP Server will be documented in this file.

## [Unreleased]

## [1.0.2] - 2025-05-11

### Fixed
- Fixed document update functionality to properly handle content replacement without errors
- Removed problematic content deletion that was causing errors with newline characters

## [1.0.1] - 2025-05-11

### Changed
- Improved user experience with more conversational responses
- Updated response formatting for all tools and resources to match Notion's clear UI style
- Removed raw API responses from being shown to users
- Formatted dates to be more human-readable
- Added helpful follow-up questions after each action

### Security
- Removed OAuth tokens from being exposed in the responses

## [1.0.0] - Initial Release

### Added
- Initial implementation of Google Docs MCP Server
- Resources for listing and retrieving Google Docs
- Tools for creating, updating, searching, and deleting documents
- Prompts for document creation and analysis
- Authentication flow for Google Docs API 