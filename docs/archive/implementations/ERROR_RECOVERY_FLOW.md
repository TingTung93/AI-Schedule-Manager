# Error Recovery Flow Diagrams

## Component Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Application Layer                       │
│                                                               │
│  ┌───────────────┐         ┌──────────────┐                │
│  │   App.jsx     │         │  Pages       │                │
│  │               │         │  - Dashboard │                │
│  │ - Offline     │         │  - Schedule  │                │
│  │   Banner      │         │  - Employees │                │
│  └───────┬───────┘         └──────┬───────┘                │
│          │                        │                          │
│          │                        │                          │
└──────────┼────────────────────────┼──────────────────────────┘
           │                        │
           ▼                        ▼
┌──────────────────────────────────────────────────────────────┐
│                      Component Layer                          │
│                                                               │
│  ┌──────────────────┐     ┌─────────────────────┐          │
│  │ ErrorRecovery    │     │  ConfigurationStep  │          │
│  │                  │     │                     │          │
│  │ - Error Display  │◄────┤ - Department Load   │          │
│  │ - Retry Button   │     │ - Staff Load        │          │
│  │ - Skip Button    │     │                     │          │
│  └──────────────────┘     └─────────────────────┘          │
│                                                               │
└───────────────────────────┬───────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│                        Hook Layer                             │
│                                                               │
│  ┌─────────────────┐   ┌──────────────────┐                │
│  │ useAsyncData    │   │ useOnlineStatus  │                │
│  │                 │   │                  │                │
│  │ - Data State    │   │ - Network Events │                │
│  │ - Loading State │   │ - Online Status  │                │
│  │ - Error State   │   │                  │                │
│  │ - Retry Logic   │   │                  │                │
│  │ - Retry Counter │   │                  │                │
│  └─────────────────┘   └──────────────────┘                │
│                                                               │
└───────────────────────────┬───────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│                       Service Layer                           │
│                                                               │
│  ┌─────────────────────────────────────┐                    │
│  │          API Service (Axios)         │                    │
│  │                                      │                    │
│  │ - HTTP Requests                      │                    │
│  │ - Error Handling                     │                    │
│  │ - Response Parsing                   │                    │
│  └─────────────────────────────────────┘                    │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

## Error Recovery Flow

### 1. Basic Error Flow

```
┌──────────────┐
│ User Action  │
│ (Load Data)  │
└──────┬───────┘
       │
       ▼
┌──────────────────┐
│ Component        │
│ Initiates        │     ┌────────────┐
│ API Call         ├────►│ Try Block  │
└──────────────────┘     └─────┬──────┘
                               │
                     ┌─────────┴─────────┐
                     │                   │
                 Success              Error
                     │                   │
                     ▼                   ▼
          ┌──────────────────┐   ┌──────────────┐
          │ Update Data      │   │ Catch Block  │
          │ Clear Loading    │   │              │
          └──────────────────┘   └──────┬───────┘
                                        │
                                        ▼
                                 ┌──────────────┐
                                 │ Set Error    │
                                 │ State        │
                                 └──────┬───────┘
                                        │
                                        ▼
                                 ┌──────────────┐
                                 │ Render       │
                                 │ ErrorRecovery│
                                 └──────┬───────┘
                                        │
                              ┌─────────┴──────────┐
                              │                    │
                          Retry                  Skip
                              │                    │
                              ▼                    ▼
                    ┌──────────────┐      ┌──────────────┐
                    │ Clear Error  │      │ Clear Error  │
                    │ Retry Call   │      │ Continue     │
                    └──────┬───────┘      └──────────────┘
                           │
                           └────► (Loop back to Try Block)
```

### 2. useAsyncData Hook Flow

```
┌────────────────────┐
│ Component Mounts   │
│ or Dependencies    │
│ Change             │
└─────────┬──────────┘
          │
          ▼
┌────────────────────┐
│ useAsyncData Hook  │
│ Executes           │
└─────────┬──────────┘
          │
          ▼
┌────────────────────┐
│ Set Loading: true  │
│ Set Error: null    │
└─────────┬──────────┘
          │
          ▼
┌────────────────────┐
│ Execute Async      │
│ Function           │
└─────────┬──────────┘
          │
    ┌─────┴─────┐
    │           │
Success      Error
    │           │
    ▼           ▼
┌────────┐  ┌──────────┐
│ Set    │  │ Set      │
│ Data   │  │ Error    │
│        │  │ Increment│
│ Call   │  │ Retry    │
│ Success│  │ Counter  │
│ CB     │  │          │
│        │  │ Call     │
│        │  │ Error CB │
└────┬───┘  └────┬─────┘
     │           │
     └─────┬─────┘
           │
           ▼
┌────────────────────┐
│ Set Loading: false │
└─────────┬──────────┘
          │
          ▼
┌────────────────────┐
│ Return             │
│ { data, loading,   │
│   error, retry,    │
│   retryCount }     │
└────────────────────┘
```

### 3. Retry Mechanism Flow

```
┌─────────────────┐
│ User Clicks     │
│ Retry Button    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ ErrorRecovery   │
│ Calls onRetry() │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Component:      │
│ - Clear Error   │
│ - Set Loading   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Re-execute      │
│ API Call        │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
Success    Error
    │         │
    ▼         ▼
┌────────┐ ┌─────────┐
│ Update │ │ Set     │
│ Data   │ │ Error   │
│ Show   │ │ Show    │
│ Success│ │ Recovery│
└────────┘ └────┬────┘
                │
                ▼
         ┌──────────────┐
         │ Retry Counter│
         │ Incremented  │
         └──────────────┘
```

### 4. Network Status Flow

```
┌────────────────┐
│ Browser        │
│ Detects        │
│ Network Change │
└────────┬───────┘
         │
         ▼
┌────────────────┐
│ window.        │
│ addEventListener│
│ ('online')     │
│ ('offline')    │
└────────┬───────┘
         │
         ▼
┌────────────────┐
│ useOnlineStatus│
│ Hook Updates   │
│ State          │
└────────┬───────┘
         │
    ┌────┴────┐
    │         │
 Online   Offline
    │         │
    ▼         ▼
┌────────┐ ┌─────────┐
│ Hide   │ │ Show    │
│ Banner │ │ Banner  │
│        │ │ "Offline│
│        │ │ Warning"│
└────────┘ └─────────┘
```

## ConfigurationStep Error Scenarios

### Scenario 1: Department Load Failure

```
User Opens Wizard
       │
       ▼
┌──────────────────┐
│ useEffect()      │
│ loadDepartments()│
└────────┬─────────┘
         │
         ▼
    API Call
         │
    ┌────┴────┐
    │         │
Success    Error (Network/Server)
    │         │
    ▼         ▼
┌────────┐ ┌─────────────────┐
│ Show   │ │ Show            │
│ Dept   │ │ ErrorRecovery   │
│ Select │ │                 │
│        │ │ "Failed to load │
│        │ │ departments"    │
│        │ │                 │
│        │ │ [Retry Button]  │
│        │ │ (No Skip)       │
└────────┘ └────────┬────────┘
                    │
              User Clicks Retry
                    │
                    └──────► loadDepartments()
                                   │
                              (Loop back)
```

### Scenario 2: Staff Load Failure (with Skip)

```
User Selects Department
       │
       ▼
┌──────────────────┐
│ useEffect()      │
│ loadStaff(deptId)│
└────────┬─────────┘
         │
         ▼
    API Call
         │
    ┌────┴────┐
    │         │
Success    Error
    │         │
    ▼         ▼
┌────────┐ ┌─────────────────────────┐
│ Show   │ │ Show ErrorRecovery      │
│ Staff  │ │                         │
│ List   │ │ "Failed to load staff"  │
│        │ │                         │
│        │ │ [Retry] [Skip]          │
└────────┘ └────────┬────────────────┘
                    │
           ┌────────┴────────┐
           │                 │
      User Retry        User Skip
           │                 │
           ▼                 ▼
    ┌──────────┐      ┌─────────────┐
    │ Retry    │      │ Clear Error │
    │ loadStaff│      │ Show Warning│
    │          │      │ "Skipped"   │
    │          │      │             │
    │          │      │ Continue    │
    │          │      │ Wizard      │
    └────┬─────┘      └─────────────┘
         │
         └──────► (Loop back to API Call)
```

## Error Message Decision Tree

```
                     Error Occurs
                          │
                ┌─────────┴─────────┐
                │                   │
        Has API Response?      No Response
                │                   │
        ┌───────┴────────┐          ▼
        │                │    ┌──────────────┐
  Has message?    No Message │ Network Error?│
        │                │    └──────┬───────┘
        ▼                │       ┌───┴────┐
┌────────────┐           │      Yes       No
│ Show API   │           │       │        │
│ Message    │           │       ▼        ▼
└────────────┘           │  ┌────────┐ ┌──────┐
                         │  │"Check  │ │Check │
                         │  │Network"│ │Error │
                         │  └────────┘ │Code  │
                         │             └──┬───┘
                         │                │
                    Check HTTP       ┌────┴────┐
                    Status Code      │         │
                         │        Timeout   Other
                         │           │         │
                    ┌────┴────┐      ▼         ▼
                    │         │   "Request  "Unknown
                   404       500+  Timed    Error"
                    │         │     Out"
                    ▼         ▼
              "Not Found" "Server
                          Error"
```

## State Management Flow

```
┌─────────────────────────────────────────────────┐
│           Component State                        │
│                                                  │
│  ┌──────────┐  ┌─────────┐  ┌────────────┐    │
│  │ data     │  │ loading │  │ error      │    │
│  │ (null)   │  │ (false) │  │ (null)     │    │
│  └──────────┘  └─────────┘  └────────────┘    │
└─────────────────────────────────────────────────┘
                     │
         User Initiates Load
                     │
                     ▼
┌─────────────────────────────────────────────────┐
│  ┌──────────┐  ┌─────────┐  ┌────────────┐    │
│  │ data     │  │ loading │  │ error      │    │
│  │ (null)   │  │ (TRUE)  │  │ (null)     │    │
│  └──────────┘  └─────────┘  └────────────┘    │
└─────────────────────────────────────────────────┘
                     │
              ┌──────┴──────┐
              │             │
          Success       Error
              │             │
              ▼             ▼
┌──────────────────┐  ┌────────────────────────┐
││ data (RESULT)   │  ││ data (null)           │
││ loading (false) │  ││ loading (false)       │
││ error (null)    │  ││ error (ERROR_OBJECT)  │
│└─────────────────┘  │└───────────────────────┘
│                     │           │
│                     │           ▼
│                     │  ┌──────────────────┐
│                     │  │ ErrorRecovery    │
│                     │  │ Rendered         │
│                     │  └──────────────────┘
└─────────────────────┘
```

## Integration Points

```
┌────────────────────────────────────────────────────┐
│                 Application                         │
│                                                     │
│  ┌────────────┐         ┌───────────────┐         │
│  │   Pages    │────────►│  Components   │         │
│  │            │         │               │         │
│  │ - Schedule │         │ - Config Step │         │
│  │ - Employee │         │ - Validation  │         │
│  │ - Dashboard│         │ - ErrorRecovery│        │
│  └────┬───────┘         └───────┬───────┘         │
│       │                         │                  │
│       │  Uses                   │  Uses            │
│       │                         │                  │
│       ▼                         ▼                  │
│  ┌────────────────┐      ┌───────────────┐        │
│  │ useOnlineStatus│      │ useAsyncData  │        │
│  └────────┬───────┘      └───────┬───────┘        │
│           │                      │                 │
│           │  Monitors            │  Manages        │
│           │                      │                 │
│           ▼                      ▼                 │
│  ┌────────────────┐      ┌───────────────┐        │
│  │ Network Events │      │ API Calls     │        │
│  └────────────────┘      └───────┬───────┘        │
│                                  │                 │
│                                  ▼                 │
│                          ┌───────────────┐        │
│                          │ Backend API   │        │
│                          └───────────────┘        │
└────────────────────────────────────────────────────┘
```

## Summary

The error recovery system provides:

1. **Clear Visual Feedback**: Users see exactly what went wrong
2. **Actionable Responses**: Retry or skip buttons for all errors
3. **State Management**: Automatic handling of loading/error states
4. **Network Awareness**: Offline detection and visual indicators
5. **Graceful Degradation**: Non-critical operations can be skipped
6. **Consistent Patterns**: Same error handling across the app
7. **Developer Friendly**: Reusable hooks and components
