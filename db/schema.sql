-- Schema-only export (no data) of the LogMonitor database, generated with mssql-scripter.
-- The original CREATE DATABASE statement (real file paths and current allocated sizes on the
-- production server) is intentionally omitted here - this is a public repo, and those are real
-- infra specifics, not schema. Restoring this elsewhere: run CREATE DATABASE [LogMonitor] with
-- your own file paths/sizes first, then run the rest of this script against it.
GO
IF (1 = FULLTEXTSERVICEPROPERTY('IsFullTextInstalled'))
begin
EXEC [LogMonitor].[dbo].[sp_fulltext_database] @action = 'enable'
end
GO
ALTER DATABASE [LogMonitor] SET ANSI_NULL_DEFAULT OFF 
GO
ALTER DATABASE [LogMonitor] SET ANSI_NULLS OFF 
GO
ALTER DATABASE [LogMonitor] SET ANSI_PADDING OFF 
GO
ALTER DATABASE [LogMonitor] SET ANSI_WARNINGS OFF 
GO
ALTER DATABASE [LogMonitor] SET ARITHABORT OFF 
GO
ALTER DATABASE [LogMonitor] SET AUTO_CLOSE OFF 
GO
ALTER DATABASE [LogMonitor] SET AUTO_SHRINK OFF 
GO
ALTER DATABASE [LogMonitor] SET AUTO_UPDATE_STATISTICS ON 
GO
ALTER DATABASE [LogMonitor] SET CURSOR_CLOSE_ON_COMMIT OFF 
GO
ALTER DATABASE [LogMonitor] SET CURSOR_DEFAULT  GLOBAL 
GO
ALTER DATABASE [LogMonitor] SET CONCAT_NULL_YIELDS_NULL OFF 
GO
ALTER DATABASE [LogMonitor] SET NUMERIC_ROUNDABORT OFF 
GO
ALTER DATABASE [LogMonitor] SET QUOTED_IDENTIFIER OFF 
GO
ALTER DATABASE [LogMonitor] SET RECURSIVE_TRIGGERS OFF 
GO
ALTER DATABASE [LogMonitor] SET  DISABLE_BROKER 
GO
ALTER DATABASE [LogMonitor] SET AUTO_UPDATE_STATISTICS_ASYNC OFF 
GO
ALTER DATABASE [LogMonitor] SET DATE_CORRELATION_OPTIMIZATION OFF 
GO
ALTER DATABASE [LogMonitor] SET TRUSTWORTHY OFF 
GO
ALTER DATABASE [LogMonitor] SET ALLOW_SNAPSHOT_ISOLATION OFF 
GO
ALTER DATABASE [LogMonitor] SET PARAMETERIZATION SIMPLE 
GO
ALTER DATABASE [LogMonitor] SET READ_COMMITTED_SNAPSHOT ON 
GO
ALTER DATABASE [LogMonitor] SET HONOR_BROKER_PRIORITY OFF 
GO
ALTER DATABASE [LogMonitor] SET RECOVERY SIMPLE 
GO
ALTER DATABASE [LogMonitor] SET  MULTI_USER 
GO
ALTER DATABASE [LogMonitor] SET PAGE_VERIFY CHECKSUM  
GO
ALTER DATABASE [LogMonitor] SET DB_CHAINING OFF 
GO
ALTER DATABASE [LogMonitor] SET FILESTREAM( NON_TRANSACTED_ACCESS = OFF ) 
GO
ALTER DATABASE [LogMonitor] SET TARGET_RECOVERY_TIME = 60 SECONDS 
GO
ALTER DATABASE [LogMonitor] SET DELAYED_DURABILITY = DISABLED 
GO
EXEC sys.sp_db_vardecimal_storage_format N'LogMonitor', N'ON'
GO
ALTER DATABASE [LogMonitor] SET QUERY_STORE = ON
GO
ALTER DATABASE [LogMonitor] SET QUERY_STORE (OPERATION_MODE = READ_WRITE, CLEANUP_POLICY = (STALE_QUERY_THRESHOLD_DAYS = 30), DATA_FLUSH_INTERVAL_SECONDS = 900, INTERVAL_LENGTH_MINUTES = 60, MAX_STORAGE_SIZE_MB = 1000, QUERY_CAPTURE_MODE = AUTO, SIZE_BASED_CLEANUP_MODE = AUTO)
GO
USE [LogMonitor]
GO
ALTER DATABASE SCOPED CONFIGURATION SET ACCELERATED_PLAN_FORCING = ON;
GO
ALTER DATABASE SCOPED CONFIGURATION SET ASYNC_STATS_UPDATE_WAIT_AT_LOW_PRIORITY = OFF;
GO
ALTER DATABASE SCOPED CONFIGURATION SET BATCH_MODE_ADAPTIVE_JOINS = ON;
GO
ALTER DATABASE SCOPED CONFIGURATION SET BATCH_MODE_MEMORY_GRANT_FEEDBACK = ON;
GO
ALTER DATABASE SCOPED CONFIGURATION SET BATCH_MODE_ON_ROWSTORE = ON;
GO
ALTER DATABASE SCOPED CONFIGURATION SET CE_FEEDBACK = ON;
GO
ALTER DATABASE SCOPED CONFIGURATION SET CE_FEEDBACK_FOR_EXPRESSIONS = ON;
GO
ALTER DATABASE SCOPED CONFIGURATION SET DEFERRED_COMPILATION_TV = ON;
GO
ALTER DATABASE SCOPED CONFIGURATION SET DOP_FEEDBACK = ON;
GO
ALTER DATABASE SCOPED CONFIGURATION SET ELEVATE_ONLINE = OFF;
GO
ALTER DATABASE SCOPED CONFIGURATION SET ELEVATE_RESUMABLE = OFF;
GO
ALTER DATABASE SCOPED CONFIGURATION SET EXEC_QUERY_STATS_FOR_SCALAR_FUNCTIONS = ON;
GO
ALTER DATABASE SCOPED CONFIGURATION SET FORCE_SHOWPLAN_RUNTIME_PARAMETER_COLLECTION = OFF;
GO
ALTER DATABASE SCOPED CONFIGURATION SET FULLTEXT_INDEX_VERSION = 2;
GO
ALTER DATABASE SCOPED CONFIGURATION SET GLOBAL_TEMPORARY_TABLE_AUTO_DROP = ON;
GO
ALTER DATABASE SCOPED CONFIGURATION SET IDENTITY_CACHE = ON;
GO
ALTER DATABASE SCOPED CONFIGURATION SET INTERLEAVED_EXECUTION_TVF = ON;
GO
ALTER DATABASE SCOPED CONFIGURATION SET ISOLATE_SECURITY_POLICY_CARDINALITY = OFF;
GO
ALTER DATABASE SCOPED CONFIGURATION SET LAST_QUERY_PLAN_STATS = OFF;
GO
ALTER DATABASE SCOPED CONFIGURATION SET LEDGER_DIGEST_STORAGE_ENDPOINT = OFF;
GO
ALTER DATABASE SCOPED CONFIGURATION SET LEGACY_CARDINALITY_ESTIMATION = OFF;
GO
ALTER DATABASE SCOPED CONFIGURATION FOR SECONDARY SET LEGACY_CARDINALITY_ESTIMATION = PRIMARY;
GO
ALTER DATABASE SCOPED CONFIGURATION SET LIGHTWEIGHT_QUERY_PROFILING = ON;
GO
ALTER DATABASE SCOPED CONFIGURATION SET MAXDOP = 0;
GO
ALTER DATABASE SCOPED CONFIGURATION FOR SECONDARY SET MAXDOP = PRIMARY;
GO
ALTER DATABASE SCOPED CONFIGURATION SET MEMORY_GRANT_FEEDBACK_PERCENTILE_GRANT = ON;
GO
ALTER DATABASE SCOPED CONFIGURATION SET MEMORY_GRANT_FEEDBACK_PERSISTENCE = ON;
GO
ALTER DATABASE SCOPED CONFIGURATION SET OPTIMIZED_PLAN_FORCING = ON;
GO
ALTER DATABASE SCOPED CONFIGURATION SET OPTIMIZED_SP_EXECUTESQL = OFF;
GO
ALTER DATABASE SCOPED CONFIGURATION SET OPTIMIZE_FOR_AD_HOC_WORKLOADS = OFF;
GO
ALTER DATABASE SCOPED CONFIGURATION SET OPTIONAL_PARAMETER_OPTIMIZATION = ON;
GO
ALTER DATABASE SCOPED CONFIGURATION SET PARAMETER_SENSITIVE_PLAN_OPTIMIZATION = ON;
GO
ALTER DATABASE SCOPED CONFIGURATION SET PARAMETER_SNIFFING = ON;
GO
ALTER DATABASE SCOPED CONFIGURATION FOR SECONDARY SET PARAMETER_SNIFFING = PRIMARY;
GO
ALTER DATABASE SCOPED CONFIGURATION SET PAUSED_RESUMABLE_INDEX_ABORT_DURATION_MINUTES = 1440;
GO
ALTER DATABASE SCOPED CONFIGURATION SET PREVIEW_FEATURES = OFF;
GO
ALTER DATABASE SCOPED CONFIGURATION SET QUERY_OPTIMIZER_HOTFIXES = OFF;
GO
ALTER DATABASE SCOPED CONFIGURATION FOR SECONDARY SET QUERY_OPTIMIZER_HOTFIXES = PRIMARY;
GO
ALTER DATABASE SCOPED CONFIGURATION SET READABLE_SECONDARY_TEMPORARY_STATS_AUTO_CREATE = ON;
GO
ALTER DATABASE SCOPED CONFIGURATION SET READABLE_SECONDARY_TEMPORARY_STATS_AUTO_UPDATE = ON;
GO
ALTER DATABASE SCOPED CONFIGURATION SET ROW_MODE_MEMORY_GRANT_FEEDBACK = ON;
GO
ALTER DATABASE SCOPED CONFIGURATION SET TSQL_SCALAR_UDF_INLINING = ON;
GO
ALTER DATABASE SCOPED CONFIGURATION SET VERBOSE_TRUNCATION_WARNINGS = ON;
GO
ALTER DATABASE SCOPED CONFIGURATION SET XTP_PROCEDURE_EXECUTION_STATISTICS = OFF;
GO
ALTER DATABASE SCOPED CONFIGURATION SET XTP_QUERY_EXECUTION_STATISTICS = OFF;
GO
/****** Object:  User [logmonitor_app]    Script Date: 11/4/2026 3:32:09 PM ******/
CREATE USER [logmonitor_app] FOR LOGIN [logmonitor_app] WITH DEFAULT_SCHEMA=[dbo]
GO
ALTER ROLE [db_owner] ADD MEMBER [logmonitor_app]
GO
/****** Object:  Table [dbo].[AdminAuditLog]    Script Date: 11/4/2026 3:32:09 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[AdminAuditLog](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[UserId] [int] NULL,
	[Username] [nvarchar](100) NOT NULL,
	[Section] [nvarchar](100) NOT NULL,
	[Action] [nvarchar](100) NOT NULL,
	[Details] [nvarchar](max) NULL,
	[IpAddress] [nvarchar](100) NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[PrevHash] [varchar](64) NULL,
	[RowHash] [varchar](64) NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[AdSyncedComputers]    Script Date: 11/4/2026 3:32:10 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[AdSyncedComputers](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[SamAccountName] [nvarchar](100) NOT NULL,
	[DnsHostName] [nvarchar](255) NULL,
	[OperatingSystem] [nvarchar](200) NULL,
	[Disabled] [bit] NOT NULL,
	[AdSyncedAt] [datetime2](7) NULL,
	[ManualIpAddress] [varchar](45) NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[AdSyncedUsers]    Script Date: 11/4/2026 3:32:10 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[AdSyncedUsers](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[Name] [nvarchar](200) NOT NULL,
	[Email] [nvarchar](200) NULL,
	[Department] [nvarchar](100) NULL,
	[Position] [nvarchar](100) NULL,
	[Phone] [nvarchar](50) NULL,
	[AdObjectGuid] [varchar](36) NOT NULL,
	[AdSamAccountName] [nvarchar](100) NULL,
	[AdDisabled] [bit] NOT NULL,
	[AdSyncedAt] [datetime2](7) NULL,
	[ManualIpAddress] [varchar](45) NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[UpdatedAt] [datetime2](7) NOT NULL,
	[Note] [nvarchar](1000) NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[AgentRolloutSettings]    Script Date: 11/4/2026 3:32:10 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[AgentRolloutSettings](
	[Id] [int] NOT NULL,
	[EmployeeTargetVersion] [nvarchar](50) NULL,
	[ServerTargetVersion] [nvarchar](50) NULL,
	[UpdatedByUserId] [int] NULL,
	[UpdatedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[AlertContacts]    Script Date: 11/4/2026 3:32:10 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[AlertContacts](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[Name] [nvarchar](200) NOT NULL,
	[ContactType] [varchar](20) NOT NULL,
	[Destination] [nvarchar](500) NOT NULL,
	[VerificationStatus] [varchar](20) NOT NULL,
	[IsActive] [bit] NOT NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[ConfigJson] [nvarchar](1000) NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[AlertEscalationStepContacts]    Script Date: 11/4/2026 3:32:10 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[AlertEscalationStepContacts](
	[StepId] [int] NOT NULL,
	[AlertContactId] [int] NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[StepId] ASC,
	[AlertContactId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[AlertEscalationSteps]    Script Date: 11/4/2026 3:32:10 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[AlertEscalationSteps](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[AlertPolicyId] [int] NOT NULL,
	[StepOrder] [int] NOT NULL,
	[DelayMinutes] [int] NOT NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[AlertPolicies]    Script Date: 11/4/2026 3:32:10 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[AlertPolicies](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[Name] [nvarchar](200) NOT NULL,
	[IsDefault] [bit] NOT NULL,
	[NotifyOnDown] [bit] NOT NULL,
	[NotifyOnRecovery] [bit] NOT NULL,
	[NotifyOnDegraded] [bit] NOT NULL,
	[NotifyOnSslExpiring] [bit] NOT NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[QuietHoursEnabled] [bit] NOT NULL,
	[QuietHoursStart] [varchar](5) NULL,
	[QuietHoursEnd] [varchar](5) NULL,
	[QuietHoursTimezone] [varchar](50) NOT NULL,
	[QuietHoursAllowCritical] [bit] NOT NULL,
	[EscalationEnabled] [bit] NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[AlertPolicyContacts]    Script Date: 11/4/2026 3:32:10 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[AlertPolicyContacts](
	[AlertPolicyId] [int] NOT NULL,
	[AlertContactId] [int] NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[AlertPolicyId] ASC,
	[AlertContactId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[ApiMonitorConfigs]    Script Date: 11/4/2026 3:32:10 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[ApiMonitorConfigs](
	[MonitorId] [int] NOT NULL,
	[Url] [nvarchar](2000) NOT NULL,
	[HttpMethod] [varchar](10) NOT NULL,
	[HeadersJson] [nvarchar](max) NULL,
	[QueryParamsJson] [nvarchar](max) NULL,
	[RequestBody] [nvarchar](max) NULL,
	[RequestBodyContentType] [varchar](100) NULL,
	[AuthType] [varchar](30) NOT NULL,
	[AuthConfigEncrypted] [nvarchar](max) NULL,
	[CachedOAuthTokenEncrypted] [nvarchar](max) NULL,
	[CachedOAuthTokenExpiresAt] [datetime2](7) NULL,
	[ExpectedStatusCode] [int] NOT NULL,
	[FollowRedirects] [bit] NOT NULL,
	[MaxRedirects] [int] NOT NULL,
	[SslVerify] [bit] NOT NULL,
	[AssertionsJson] [nvarchar](max) NULL,
	[ResponseTimeWarningMs] [int] NOT NULL,
	[ResponseTimeCriticalMs] [int] NOT NULL,
	[AlertEmail] [nvarchar](1000) NULL,
PRIMARY KEY CLUSTERED 
(
	[MonitorId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[AppActivitySettings]    Script Date: 11/4/2026 3:32:10 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[AppActivitySettings](
	[Id] [int] NOT NULL,
	[IdleTimeoutSeconds] [int] NOT NULL,
	[CollectWindowTitles] [bit] NOT NULL,
	[RetentionDays] [int] NOT NULL,
	[ExcludedProcessNamesJson] [nvarchar](max) NULL,
	[UpdatedByUserId] [int] NULL,
	[UpdatedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[AppCategories]    Script Date: 11/4/2026 3:32:10 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[AppCategories](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[Name] [nvarchar](100) NOT NULL,
	[RiskLevel] [varchar](20) NOT NULL,
	[IsBuiltIn] [bit] NOT NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[UpdatedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[AppCategoryRules]    Script Date: 11/4/2026 3:32:10 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[AppCategoryRules](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[ProcessName] [nvarchar](255) NOT NULL,
	[CategoryId] [int] NOT NULL,
	[MatchType] [varchar](10) NOT NULL,
	[Source] [varchar](20) NOT NULL,
	[CreatedByUserId] [int] NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[AppUsageSessions]    Script Date: 11/4/2026 3:32:10 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[AppUsageSessions](
	[Id] [bigint] IDENTITY(1,1) NOT NULL,
	[DeviceId] [varchar](36) NOT NULL,
	[StaffId] [int] NULL,
	[ProcessName] [nvarchar](255) NOT NULL,
	[ExePath] [nvarchar](500) NULL,
	[StartedAt] [datetime2](7) NOT NULL,
	[LastSeenAt] [datetime2](7) NOT NULL,
	[EndedAt] [datetime2](7) NULL,
	[ReceivedAt] [datetime2](7) NOT NULL,
	[ActiveDurationSeconds] [int] NULL,
	[IdleDurationSeconds] [int] NULL,
	[WindowTitle] [nvarchar](500) NULL,
	[CategoryId] [int] NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[AssetAttachments]    Script Date: 11/4/2026 3:32:10 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[AssetAttachments](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[AssetId] [int] NOT NULL,
	[MaintenanceLogId] [int] NULL,
	[PatchUpdateLogId] [int] NULL,
	[SoftwareInventoryId] [int] NULL,
	[OriginalFileName] [nvarchar](300) NOT NULL,
	[StoredFileName] [varchar](100) NOT NULL,
	[ContentType] [nvarchar](150) NOT NULL,
	[SizeBytes] [bigint] NOT NULL,
	[UploadedByUserId] [int] NULL,
	[UploadedByUsername] [nvarchar](100) NULL,
	[UploadedAt] [datetime2](7) NOT NULL,
	[IsDeleted] [bit] NOT NULL,
	[DeletedAt] [datetime2](7) NULL,
	[DeletedByUserId] [int] NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Assets]    Script Date: 11/4/2026 3:32:10 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Assets](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[AssetTag] [nvarchar](100) NOT NULL,
	[Hostname] [nvarchar](255) NULL,
	[DeviceName] [nvarchar](255) NULL,
	[AssetType] [varchar](30) NOT NULL,
	[DeviceCategory] [nvarchar](100) NULL,
	[Manufacturer] [nvarchar](200) NULL,
	[Model] [nvarchar](200) NULL,
	[SerialNumber] [nvarchar](200) NULL,
	[OperatingSystem] [nvarchar](200) NULL,
	[OsVersion] [nvarchar](100) NULL,
	[IpAddress] [varchar](45) NULL,
	[MacAddress] [varchar](20) NULL,
	[DomainOrWorkgroup] [nvarchar](200) NULL,
	[IsVirtual] [bit] NOT NULL,
	[Department] [nvarchar](200) NULL,
	[Location] [nvarchar](200) NULL,
	[AssignedUser] [nvarchar](200) NULL,
	[AssetOwner] [nvarchar](200) NULL,
	[ResponsibleTechnician] [nvarchar](200) NULL,
	[PurchaseDate] [date] NULL,
	[WarrantyExpiryDate] [date] NULL,
	[InstallationDate] [date] NULL,
	[Status] [varchar](20) NOT NULL,
	[Criticality] [varchar](10) NOT NULL,
	[Environment] [nvarchar](50) NULL,
	[LastInventoryCheckDate] [date] NULL,
	[NextInventoryCheckDate] [date] NULL,
	[Notes] [nvarchar](max) NULL,
	[LinkedDeviceId] [int] NULL,
	[LinkedStaffId] [int] NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[CreatedByUserId] [int] NULL,
	[CreatedByUsername] [nvarchar](100) NULL,
	[UpdatedAt] [datetime2](7) NOT NULL,
	[UpdatedByUserId] [int] NULL,
	[UpdatedByUsername] [nvarchar](100) NULL,
	[IsDeleted] [bit] NOT NULL,
	[DeletedAt] [datetime2](7) NULL,
	[DeletedByUserId] [int] NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY],
 CONSTRAINT [UQ_Assets_AssetTag] UNIQUE NONCLUSTERED 
(
	[AssetTag] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[AutomationJobs]    Script Date: 11/4/2026 3:32:10 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[AutomationJobs](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[ScriptId] [int] NULL,
	[ScriptNameSnapshot] [nvarchar](200) NOT NULL,
	[PowerShellBodySnapshot] [nvarchar](max) NULL,
	[BashBodySnapshot] [nvarchar](max) NULL,
	[TimeoutSeconds] [int] NOT NULL,
	[TriggerType] [varchar](20) NOT NULL,
	[ScheduleId] [int] NULL,
	[RequestedByUserId] [int] NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[AutomationJobTargets]    Script Date: 11/4/2026 3:32:10 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[AutomationJobTargets](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[JobId] [int] NOT NULL,
	[DeviceId] [varchar](36) NOT NULL,
	[Status] [varchar](20) NOT NULL,
	[ExitCode] [int] NULL,
	[Stdout] [nvarchar](max) NULL,
	[Stderr] [nvarchar](max) NULL,
	[ErrorMessage] [nvarchar](1000) NULL,
	[StartedAt] [datetime2](7) NULL,
	[CompletedAt] [datetime2](7) NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[AutomationSchedules]    Script Date: 11/4/2026 3:32:10 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[AutomationSchedules](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[ScriptId] [int] NOT NULL,
	[Name] [nvarchar](200) NOT NULL,
	[IntervalMinutes] [int] NOT NULL,
	[NextRunAt] [datetime2](7) NOT NULL,
	[LastRunAt] [datetime2](7) NULL,
	[IsActive] [bit] NOT NULL,
	[CreatedByUserId] [int] NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[UpdatedByUserId] [int] NULL,
	[UpdatedAt] [datetime2](7) NOT NULL,
	[IsDeleted] [bit] NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[AutomationScheduleTargets]    Script Date: 11/4/2026 3:32:10 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[AutomationScheduleTargets](
	[AutomationScheduleId] [int] NOT NULL,
	[DeviceId] [varchar](36) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[AutomationScheduleId] ASC,
	[DeviceId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[AutomationScripts]    Script Date: 11/4/2026 3:32:10 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[AutomationScripts](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[Name] [nvarchar](200) NOT NULL,
	[Description] [nvarchar](1000) NULL,
	[PowerShellBody] [nvarchar](max) NULL,
	[BashBody] [nvarchar](max) NULL,
	[TimeoutSeconds] [int] NOT NULL,
	[CreatedByUserId] [int] NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[UpdatedByUserId] [int] NULL,
	[UpdatedAt] [datetime2](7) NOT NULL,
	[IsDeleted] [bit] NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[BackupHistory]    Script Date: 11/4/2026 3:32:10 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[BackupHistory](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[FileName] [nvarchar](300) NOT NULL,
	[FilePath] [nvarchar](500) NOT NULL,
	[SizeBytes] [bigint] NULL,
	[Status] [varchar](20) NOT NULL,
	[ErrorMessage] [nvarchar](1000) NULL,
	[TriggeredByUserId] [int] NULL,
	[TriggeredByUsername] [nvarchar](100) NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[BackupType] [nvarchar](20) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[BranchOffices]    Script Date: 11/4/2026 3:32:10 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[BranchOffices](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[Name] [nvarchar](150) NOT NULL,
	[Address] [nvarchar](300) NULL,
	[City] [nvarchar](100) NULL,
	[Country] [nvarchar](100) NULL,
	[Phone] [nvarchar](50) NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[UpdatedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[BrowserActivityConsentAck]    Script Date: 11/4/2026 3:32:10 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[BrowserActivityConsentAck](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[DeviceId] [varchar](36) NOT NULL,
	[StaffId] [int] NULL,
	[NoticeVersion] [varchar](20) NOT NULL,
	[AcknowledgedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[BrowserActivityEngagementAlerts]    Script Date: 11/4/2026 3:32:10 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[BrowserActivityEngagementAlerts](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[StaffId] [int] NOT NULL,
	[Domain] [nvarchar](255) NOT NULL,
	[AlertDate] [date] NOT NULL,
	[TotalDwellSeconds] [int] NOT NULL,
	[SentAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[BrowserActivityEvents]    Script Date: 11/4/2026 3:32:10 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[BrowserActivityEvents](
	[Id] [bigint] IDENTITY(1,1) NOT NULL,
	[DeviceId] [varchar](36) NOT NULL,
	[StaffId] [int] NULL,
	[Browser] [varchar](20) NOT NULL,
	[Domain] [nvarchar](255) NOT NULL,
	[PageTitle] [nvarchar](500) NULL,
	[VisitedAt] [datetime2](7) NOT NULL,
	[DwellSeconds] [int] NULL,
	[CategoryId] [int] NULL,
	[RiskLevel] [varchar](20) NOT NULL,
	[IsSecurityEvent] [bit] NOT NULL,
	[SecurityEventType] [varchar](30) NULL,
	[ReceivedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[BrowserActivitySettings]    Script Date: 11/4/2026 3:32:10 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[BrowserActivitySettings](
	[Id] [int] NOT NULL,
	[RetentionDays] [int] NOT NULL,
	[CollectPageTitles] [bit] NOT NULL,
	[DefaultIntervalMinutes] [int] NOT NULL,
	[UpdatedByUserId] [int] NULL,
	[UpdatedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[CameraMotionSchedule]    Script Date: 11/4/2026 3:32:10 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[CameraMotionSchedule](
	[Id] [int] NOT NULL,
	[MorningActiveUntil] [char](5) NOT NULL,
	[EveningActiveFrom] [char](5) NOT NULL,
	[AlwaysActiveDays] [varchar](20) NOT NULL,
	[UpdatedAt] [datetime2](7) NOT NULL,
	[UpdatedByUserId] [int] NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[CameraMotionWatchers]    Script Date: 11/4/2026 3:32:10 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[CameraMotionWatchers](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[CameraId] [int] NOT NULL,
	[Enabled] [bit] NOT NULL,
	[Recipients] [nvarchar](500) NOT NULL,
	[DiffThreshold] [float] NOT NULL,
	[CooldownSeconds] [int] NOT NULL,
	[BeepManish] [bit] NOT NULL,
	[UpdatedAt] [datetime2](7) NOT NULL,
	[UpdatedByUserId] [int] NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY],
UNIQUE NONCLUSTERED 
(
	[CameraId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[ChatMessages]    Script Date: 11/4/2026 3:32:10 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[ChatMessages](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[StaffId] [int] NOT NULL,
	[DeviceId] [int] NULL,
	[SenderType] [nvarchar](10) NOT NULL,
	[SenderName] [nvarchar](100) NOT NULL,
	[Message] [nvarchar](max) NOT NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[ReadByAdminAt] [datetime2](7) NULL,
	[ReadByEmployeeAt] [datetime2](7) NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[CodeQualityGitHubConnections]    Script Date: 11/4/2026 3:32:10 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[CodeQualityGitHubConnections](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[Name] [nvarchar](200) NOT NULL,
	[AuthMethod] [varchar](20) NOT NULL,
	[OwnerLogin] [nvarchar](200) NULL,
	[AccessTokenEncrypted] [nvarchar](max) NULL,
	[RefreshTokenEncrypted] [nvarchar](max) NULL,
	[TokenExpiresAt] [datetime2](7) NULL,
	[InstallationId] [bigint] NULL,
	[ScopesGranted] [nvarchar](500) NULL,
	[CreatedByUserId] [int] NOT NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[UpdatedAt] [datetime2](7) NOT NULL,
	[DeletedAt] [datetime2](7) NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[CodeQualityGitLabConnections]    Script Date: 11/4/2026 3:32:10 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[CodeQualityGitLabConnections](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[Name] [nvarchar](200) NOT NULL,
	[InstanceUrl] [nvarchar](500) NOT NULL,
	[OwnerLogin] [nvarchar](200) NULL,
	[AccessTokenEncrypted] [nvarchar](max) NOT NULL,
	[CreatedByUserId] [int] NOT NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[UpdatedAt] [datetime2](7) NOT NULL,
	[DeletedAt] [datetime2](7) NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[CodeQualityIssues]    Script Date: 11/4/2026 3:32:10 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[CodeQualityIssues](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[IssueNumber] [nvarchar](20) NULL,
	[ProjectId] [int] NOT NULL,
	[ScanId] [int] NOT NULL,
	[Category] [varchar](30) NOT NULL,
	[RuleCode] [nvarchar](100) NULL,
	[Title] [nvarchar](300) NOT NULL,
	[Description] [nvarchar](2000) NULL,
	[FilePath] [nvarchar](1000) NOT NULL,
	[StartLine] [int] NULL,
	[EndLine] [int] NULL,
	[CodeElement] [nvarchar](300) NULL,
	[Severity] [varchar](20) NOT NULL,
	[Status] [varchar](20) NOT NULL,
	[ConfidenceLevel] [varchar](20) NULL,
	[Recommendation] [nvarchar](2000) NULL,
	[CodeSnippet] [nvarchar](max) NULL,
	[ResolutionNote] [nvarchar](2000) NULL,
	[ResolvedByUserId] [int] NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[UpdatedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[CodeQualityMetrics]    Script Date: 11/4/2026 3:32:10 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[CodeQualityMetrics](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[ScanId] [int] NOT NULL,
	[MetricType] [varchar](30) NOT NULL,
	[MetricName] [nvarchar](200) NOT NULL,
	[Value] [float] NOT NULL,
	[Threshold] [float] NULL,
	[AdditionalData] [nvarchar](max) NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[CodeQualityProjects]    Script Date: 11/4/2026 3:32:10 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[CodeQualityProjects](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[Name] [nvarchar](200) NOT NULL,
	[Description] [nvarchar](1000) NULL,
	[RepositoryUrl] [nvarchar](500) NULL,
	[SourcePath] [nvarchar](1000) NOT NULL,
	[DefaultBranch] [nvarchar](200) NULL,
	[Language] [nvarchar](50) NULL,
	[ScanConfig] [nvarchar](max) NULL,
	[Status] [varchar](20) NOT NULL,
	[CreatedByUserId] [int] NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[UpdatedAt] [datetime2](7) NOT NULL,
	[DeletedAt] [datetime2](7) NULL,
	[GitHubConnectionId] [int] NULL,
	[RepositoryOwner] [nvarchar](200) NULL,
	[RepositoryName] [nvarchar](200) NULL,
	[RepositoryRef] [nvarchar](200) NULL,
	[LastSyncedCommitSha] [nvarchar](64) NULL,
	[LastSyncedAt] [datetime2](7) NULL,
	[GitLabConnectionId] [int] NULL,
	[RepoConnectionId] [int] NULL,
	[RepoProvider] [varchar](20) NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[CodeQualityRules]    Script Date: 11/4/2026 3:32:10 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[CodeQualityRules](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[RuleCode] [nvarchar](100) NOT NULL,
	[RuleName] [nvarchar](200) NOT NULL,
	[Description] [nvarchar](1000) NULL,
	[Category] [varchar](30) NOT NULL,
	[DefaultSeverity] [varchar](20) NOT NULL,
	[Enabled] [bit] NOT NULL,
	[Configuration] [nvarchar](max) NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[UpdatedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY],
UNIQUE NONCLUSTERED 
(
	[RuleCode] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[CodeQualityScanLog]    Script Date: 11/4/2026 3:32:10 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[CodeQualityScanLog](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[ScanId] [int] NOT NULL,
	[Message] [nvarchar](1000) NOT NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[CodeQualityScans]    Script Date: 11/4/2026 3:32:10 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[CodeQualityScans](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[ProjectId] [int] NOT NULL,
	[Branch] [nvarchar](200) NULL,
	[ScanType] [varchar](20) NOT NULL,
	[Status] [varchar](20) NOT NULL,
	[StartedByUserId] [int] NULL,
	[StartedAt] [datetime2](7) NULL,
	[CompletedAt] [datetime2](7) NULL,
	[DurationMs] [int] NULL,
	[FilesScanned] [int] NOT NULL,
	[LinesOfCode] [int] NOT NULL,
	[QualityScore] [int] NULL,
	[ErrorMessage] [nvarchar](2000) NULL,
	[ConfigSnapshot] [nvarchar](max) NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[CodeQualitySettings]    Script Date: 11/4/2026 3:32:10 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[CodeQualitySettings](
	[Id] [int] NOT NULL,
	[ComplexityLowMax] [int] NOT NULL,
	[ComplexityMediumMax] [int] NOT NULL,
	[ComplexityHighMax] [int] NOT NULL,
	[DuplicationThresholdPercent] [float] NOT NULL,
	[MinDuplicateBlockSize] [int] NOT NULL,
	[WeightComplexity] [float] NOT NULL,
	[WeightDuplication] [float] NOT NULL,
	[WeightDeadCode] [float] NOT NULL,
	[WeightUnusedVariables] [float] NOT NULL,
	[WeightUnusedFunctions] [float] NOT NULL,
	[WeightCodingStandards] [float] NOT NULL,
	[ScaleComplexity] [float] NOT NULL,
	[ScaleDuplication] [float] NOT NULL,
	[ScaleDeadCode] [float] NOT NULL,
	[ScaleUnusedVariables] [float] NOT NULL,
	[ScaleUnusedFunctions] [float] NOT NULL,
	[ScaleCodingStandards] [float] NOT NULL,
	[ExcludedDirectories] [nvarchar](max) NULL,
	[AllowedExtensions] [nvarchar](500) NOT NULL,
	[MaxScanSizeMb] [int] NOT NULL,
	[ScanTimeoutSeconds] [int] NOT NULL,
	[RetentionDays] [int] NOT NULL,
	[UpdatedAt] [datetime2](7) NOT NULL,
	[UpdatedByUserId] [int] NULL,
	[MaxLineLength] [int] NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[CompanySettings]    Script Date: 11/4/2026 3:32:10 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[CompanySettings](
	[Id] [int] NOT NULL,
	[CompanyName] [nvarchar](200) NULL,
	[LogoPath] [nvarchar](500) NULL,
	[WebsiteUrl] [nvarchar](500) NULL,
	[Industry] [nvarchar](100) NULL,
	[CompanySize] [nvarchar](50) NULL,
	[AddressLine1] [nvarchar](300) NULL,
	[AddressLine2] [nvarchar](300) NULL,
	[City] [nvarchar](100) NULL,
	[State] [nvarchar](100) NULL,
	[PostalCode] [nvarchar](30) NULL,
	[Country] [nvarchar](100) NULL,
	[ContactEmail] [nvarchar](200) NULL,
	[ContactPhone] [nvarchar](50) NULL,
	[PrimaryColor] [varchar](20) NULL,
	[SecondaryColor] [varchar](20) NULL,
	[FaviconPath] [nvarchar](500) NULL,
	[LoginBrandingEnabled] [bit] NOT NULL,
	[LoginTagline] [nvarchar](300) NULL,
	[FooterText] [nvarchar](max) NULL,
	[DefaultTimezone] [nvarchar](100) NULL,
	[DefaultLanguage] [nvarchar](20) NULL,
	[DateFormat] [nvarchar](30) NULL,
	[TimeFormat] [nvarchar](30) NULL,
	[MaintenanceModeEnabled] [bit] NOT NULL,
	[MaintenanceMessage] [nvarchar](max) NULL,
	[RetentionPolicyDays] [int] NULL,
	[RetentionPolicyNotes] [nvarchar](max) NULL,
	[BackupScheduleEnabled] [bit] NOT NULL,
	[BackupScheduleFrequency] [nvarchar](20) NULL,
	[BackupScheduleTime] [nvarchar](10) NULL,
	[BackupRetentionCount] [int] NULL,
	[UpdatedAt] [datetime2](7) NOT NULL,
	[UpdatedByUserId] [int] NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[ComplianceControlEvidence]    Script Date: 11/4/2026 3:32:10 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[ComplianceControlEvidence](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[ControlId] [int] NOT NULL,
	[Type] [varchar](10) NOT NULL,
	[Url] [nvarchar](1000) NULL,
	[FilePath] [nvarchar](500) NULL,
	[OriginalFileName] [nvarchar](255) NULL,
	[ContentType] [nvarchar](100) NULL,
	[SizeBytes] [int] NULL,
	[Label] [nvarchar](255) NULL,
	[CreatedByUserId] [int] NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[ComplianceControls]    Script Date: 11/4/2026 3:32:10 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[ComplianceControls](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[FrameworkId] [int] NOT NULL,
	[ControlCode] [nvarchar](30) NOT NULL,
	[Category] [nvarchar](100) NOT NULL,
	[Title] [nvarchar](300) NOT NULL,
	[Description] [nvarchar](1000) NULL,
	[AutoCheckKey] [varchar](50) NULL,
	[SortOrder] [int] NOT NULL,
	[Status] [varchar](20) NOT NULL,
	[Evidence] [nvarchar](max) NULL,
	[Notes] [nvarchar](max) NULL,
	[OwnerUserId] [int] NULL,
	[ReviewedAt] [datetime2](7) NULL,
	[AutoCheckStatus] [varchar](10) NULL,
	[AutoCheckDetail] [nvarchar](500) NULL,
	[AutoCheckedAt] [datetime2](7) NULL,
	[UpdatedAt] [datetime2](7) NOT NULL,
	[UpdatedByUserId] [int] NULL,
	[ResponsibleStaffId] [int] NULL,
	[ResponsibleName] [nvarchar](200) NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[ComplianceFrameworks]    Script Date: 11/4/2026 3:32:11 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[ComplianceFrameworks](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[Key] [varchar](20) NOT NULL,
	[Name] [nvarchar](100) NOT NULL,
	[Description] [nvarchar](500) NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY],
UNIQUE NONCLUSTERED 
(
	[Key] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[ContactMessages]    Script Date: 11/4/2026 3:32:11 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[ContactMessages](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[Name] [nvarchar](200) NOT NULL,
	[Email] [nvarchar](200) NOT NULL,
	[Phone] [varchar](50) NULL,
	[Subject] [nvarchar](300) NULL,
	[Message] [nvarchar](max) NOT NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[ReadAt] [datetime2](7) NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[DashboardLayouts]    Script Date: 11/4/2026 3:32:11 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[DashboardLayouts](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[UserId] [int] NOT NULL,
	[Name] [nvarchar](100) NOT NULL,
	[IsActive] [bit] NOT NULL,
	[LayoutJson] [nvarchar](max) NOT NULL,
	[RefreshIntervalSeconds] [int] NOT NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[UpdatedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[DashboardNotes]    Script Date: 11/4/2026 3:32:11 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[DashboardNotes](
	[UserId] [int] NOT NULL,
	[Content] [nvarchar](max) NOT NULL,
	[UpdatedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[UserId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[DbAnalyzerAiConfig]    Script Date: 11/4/2026 3:32:11 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[DbAnalyzerAiConfig](
	[Id] [int] NOT NULL,
	[Provider] [nvarchar](50) NULL,
	[BaseUrl] [nvarchar](255) NULL,
	[ApiKeyEncrypted] [nvarchar](500) NULL,
	[Model] [nvarchar](100) NULL,
	[Mode] [varchar](10) NOT NULL,
	[Enabled] [bit] NOT NULL,
	[LastTestAt] [datetime2](7) NULL,
	[LastTestSuccess] [bit] NULL,
	[LastTestMessage] [nvarchar](500) NULL,
	[UpdatedAt] [datetime2](7) NULL,
	[UpdatedByUserId] [int] NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[DbAnalyzerConnections]    Script Date: 11/4/2026 3:32:11 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[DbAnalyzerConnections](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[Name] [nvarchar](200) NOT NULL,
	[Engine] [varchar](20) NOT NULL,
	[HostName] [nvarchar](255) NULL,
	[Port] [int] NULL,
	[DatabaseName] [nvarchar](200) NULL,
	[Username] [nvarchar](200) NULL,
	[PasswordEncrypted] [nvarchar](500) NULL,
	[Enabled] [bit] NOT NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[CreatedByUserId] [int] NULL,
	[Source] [varchar](10) NOT NULL,
	[UploadedSqlText] [nvarchar](max) NULL,
	[SourceFileName] [nvarchar](255) NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[DbAnalyzerFindings]    Script Date: 11/4/2026 3:32:11 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[DbAnalyzerFindings](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[ScanId] [int] NOT NULL,
	[ConnectionId] [int] NOT NULL,
	[Category] [varchar](20) NOT NULL,
	[Severity] [varchar](10) NOT NULL,
	[Title] [nvarchar](500) NOT NULL,
	[Detail] [nvarchar](max) NULL,
	[Evidence] [nvarchar](max) NULL,
	[AffectedObject] [nvarchar](500) NULL,
	[Recommendation] [nvarchar](1000) NULL,
	[Source] [varchar](10) NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[DbAnalyzerScans]    Script Date: 11/4/2026 3:32:11 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[DbAnalyzerScans](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[ConnectionId] [int] NOT NULL,
	[Status] [varchar](20) NOT NULL,
	[StartedAt] [datetime2](7) NOT NULL,
	[CompletedAt] [datetime2](7) NULL,
	[TriggeredByUserId] [int] NULL,
	[TriggeredBy] [nvarchar](200) NULL,
	[TableCount] [int] NULL,
	[FindingCount] [int] NULL,
	[SecurityScore] [int] NULL,
	[RiskLevel] [varchar](20) NULL,
	[ServerVersion] [nvarchar](500) NULL,
	[SchemaJson] [nvarchar](max) NULL,
	[ErrorMessage] [nvarchar](1000) NULL,
	[AnalysisMode] [varchar](10) NULL,
	[AiSummary] [nvarchar](max) NULL,
	[AiError] [nvarchar](1000) NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Departments]    Script Date: 11/4/2026 3:32:11 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Departments](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[Name] [nvarchar](150) NOT NULL,
	[Description] [nvarchar](500) NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[UpdatedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[DeviceAlerts]    Script Date: 11/4/2026 3:32:11 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[DeviceAlerts](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[DeviceId] [varchar](36) NOT NULL,
	[AlertType] [varchar](50) NOT NULL,
	[Severity] [varchar](20) NOT NULL,
	[Message] [nvarchar](500) NOT NULL,
	[TriggeredAt] [datetime2](7) NOT NULL,
	[ResolvedAt] [datetime2](7) NULL,
	[AcknowledgedByUserId] [int] NULL,
	[AcknowledgedAt] [datetime2](7) NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[DeviceDisks]    Script Date: 11/4/2026 3:32:11 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[DeviceDisks](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[DeviceId] [varchar](36) NOT NULL,
	[DiskIndex] [int] NOT NULL,
	[Model] [nvarchar](200) NULL,
	[Type] [varchar](20) NULL,
	[CapacityGB] [float] NULL,
	[UpdatedAt] [datetime2](7) NOT NULL,
	[HealthStatus] [nvarchar](50) NULL,
	[OperationalStatus] [nvarchar](100) NULL,
	[TemperatureCelsius] [float] NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[DeviceHardwareInfo]    Script Date: 11/4/2026 3:32:11 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[DeviceHardwareInfo](
	[DeviceId] [varchar](36) NOT NULL,
	[CpuModel] [nvarchar](200) NULL,
	[CpuManufacturer] [nvarchar](100) NULL,
	[CpuCores] [int] NULL,
	[CpuThreads] [int] NULL,
	[CpuClockMhz] [float] NULL,
	[MemoryTotalMB] [bigint] NULL,
	[DiskModel] [nvarchar](200) NULL,
	[DiskType] [varchar](10) NULL,
	[DiskCapacityGB] [float] NULL,
	[GpuName] [nvarchar](200) NULL,
	[OsEdition] [nvarchar](100) NULL,
	[OsBuild] [nvarchar](100) NULL,
	[KernelVersion] [nvarchar](100) NULL,
	[Architecture] [varchar](20) NULL,
	[UpdatedAt] [datetime2](7) NOT NULL,
	[MotherboardManufacturer] [nvarchar](150) NULL,
	[MotherboardModel] [nvarchar](150) NULL,
	[BiosManufacturer] [nvarchar](150) NULL,
	[BiosReleaseDate] [nvarchar](100) NULL,
PRIMARY KEY CLUSTERED 
(
	[DeviceId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[DeviceLocalUsers]    Script Date: 11/4/2026 3:32:11 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[DeviceLocalUsers](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[DeviceId] [varchar](64) NOT NULL,
	[Username] [nvarchar](255) NOT NULL,
	[FullName] [nvarchar](255) NULL,
	[IsAdmin] [bit] NOT NULL,
	[IsDisabled] [bit] NOT NULL,
	[LastLogon] [nvarchar](64) NULL,
	[UpdatedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[DeviceMetrics]    Script Date: 11/4/2026 3:32:11 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[DeviceMetrics](
	[Id] [bigint] IDENTITY(1,1) NOT NULL,
	[DeviceId] [varchar](36) NOT NULL,
	[ReceivedAt] [datetime2](7) NOT NULL,
	[CpuPct] [float] NULL,
	[MemPct] [float] NULL,
	[DiskPct] [float] NULL,
	[NetRxMbps] [float] NULL,
	[NetTxMbps] [float] NULL,
	[UptimeSeconds] [bigint] NULL,
	[SwapPct] [float] NULL,
	[DiskReadMBps] [float] NULL,
	[DiskWriteMBps] [float] NULL,
	[DiskIops] [float] NULL,
	[ProcessCount] [int] NULL,
	[ThreadCount] [int] NULL,
	[HandleCount] [int] NULL,
	[LoadAvg1] [float] NULL,
	[LoadAvg5] [float] NULL,
	[LoadAvg15] [float] NULL,
	[GpuUsagePct] [float] NULL,
	[BatteryPct] [float] NULL,
	[BatteryHealth] [nvarchar](50) NULL,
	[BatteryCycleCount] [int] NULL,
	[PowerAdapterConnected] [bit] NULL,
	[CpuTempC] [float] NULL,
	[DiskFreeGB] [float] NULL,
	[DiskTotalGB] [float] NULL,
	[DiskLatencyMs] [float] NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[DeviceNetworkInfo]    Script Date: 11/4/2026 3:32:11 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[DeviceNetworkInfo](
	[DeviceId] [varchar](36) NOT NULL,
	[CurrentIp] [varchar](45) NULL,
	[PublicIp] [varchar](45) NULL,
	[GatewayIp] [varchar](45) NULL,
	[DnsServers] [nvarchar](500) NULL,
	[WifiSsid] [nvarchar](200) NULL,
	[VpnActive] [bit] NULL,
	[EthernetConnected] [bit] NULL,
	[OpenPortsJson] [nvarchar](max) NULL,
	[ListeningPortsJson] [nvarchar](max) NULL,
	[UpdatedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[DeviceId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[DeviceNetworkInterfaces]    Script Date: 11/4/2026 3:32:11 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[DeviceNetworkInterfaces](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[DeviceId] [varchar](36) NOT NULL,
	[InterfaceName] [nvarchar](100) NULL,
	[MacAddress] [varchar](64) NULL,
	[IpAddresses] [nvarchar](500) NULL,
	[IsUp] [bit] NULL,
	[SpeedMbps] [int] NULL,
	[UpdatedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[DeviceProcessSnapshot]    Script Date: 11/4/2026 3:32:11 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[DeviceProcessSnapshot](
	[DeviceId] [varchar](36) NOT NULL,
	[ProcessesJson] [nvarchar](max) NOT NULL,
	[UpdatedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[DeviceId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Devices]    Script Date: 11/4/2026 3:32:11 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Devices](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[DeviceId] [varchar](36) NOT NULL,
	[Hostname] [nvarchar](255) NOT NULL,
	[OS] [varchar](20) NOT NULL,
	[OsVersion] [nvarchar](100) NULL,
	[ApiKeyHash] [nvarchar](255) NOT NULL,
	[StaffId] [int] NULL,
	[Department] [nvarchar](100) NULL,
	[AgentVersion] [nvarchar](50) NULL,
	[EnrolledAt] [datetime2](7) NOT NULL,
	[LastHeartbeat] [datetime2](7) NULL,
	[LastIp] [varchar](45) NULL,
	[ScreenshotIntervalMinutes] [int] NULL,
	[PrivacyMode] [bit] NOT NULL,
	[ConsentAcceptedAt] [datetime2](7) NULL,
	[DeviceUUID] [varchar](64) NULL,
	[MachineId] [varchar](64) NULL,
	[Manufacturer] [nvarchar](200) NULL,
	[Model] [nvarchar](200) NULL,
	[SerialNumber] [nvarchar](200) NULL,
	[AssetTag] [nvarchar](100) NULL,
	[BiosVersion] [nvarchar](200) NULL,
	[MotherboardSerial] [nvarchar](200) NULL,
	[Domain] [nvarchar](200) NULL,
	[Workgroup] [nvarchar](200) NULL,
	[Timezone] [nvarchar](100) NULL,
	[Country] [nvarchar](100) NULL,
	[CurrentUser] [nvarchar](200) NULL,
	[MacAddress] [varchar](20) NULL,
	[DeviceType] [nvarchar](20) NOT NULL,
	[DeviceName] [nvarchar](200) NULL,
	[ServerRole] [nvarchar](100) NULL,
	[StaticIpAddress] [varchar](45) NULL,
	[LifecycleStatus] [nvarchar](20) NOT NULL,
	[ChatToken] [nvarchar](64) NULL,
	[LastNotificationSeenId] [int] NOT NULL,
	[LastBootTime] [datetime2](7) NULL,
	[LastWindowsUpdateAt] [datetime2](7) NULL,
	[RecentHotfixCount] [int] NULL,
	[RebootPending] [bit] NULL,
	[IisDetected] [bit] NOT NULL,
	[LastIisCheckAt] [datetime2](7) NULL,
	[LinuxSecurityDetected] [bit] NOT NULL,
	[LastLinuxSecurityCheckAt] [datetime2](7) NULL,
	[PhpDetected] [bit] NOT NULL,
	[LastPhpCheckAt] [datetime2](7) NULL,
	[BrowserActivityIntervalMinutes] [int] NULL,
	[RemoteConnectionId] [int] NULL,
	[WebsiteBlockingEnabled] [bit] NOT NULL,
	[WacLastAppliedAt] [datetime2](7) NULL,
	[WacLastError] [nvarchar](1000) NULL,
	[AppActivityIntervalMinutes] [int] NULL,
	[AgentTargetVersion] [varchar](40) NULL,
	[IsRevoked] [bit] NOT NULL,
	[RevokedAt] [datetime2](7) NULL,
	[RevokedByUserId] [int] NULL,
	[ApiKeyRotatedAt] [datetime2](7) NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY],
UNIQUE NONCLUSTERED 
(
	[DeviceId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[DeviceSecurityStatus]    Script Date: 11/4/2026 3:32:11 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[DeviceSecurityStatus](
	[DeviceId] [varchar](36) NOT NULL,
	[AntivirusStatus] [nvarchar](50) NULL,
	[DefenderStatus] [nvarchar](50) NULL,
	[FirewallEnabled] [bit] NULL,
	[FirewallRulesCount] [int] NULL,
	[BitLockerStatus] [nvarchar](50) NULL,
	[LuksStatus] [nvarchar](50) NULL,
	[SecureBootEnabled] [bit] NULL,
	[TpmVersion] [nvarchar](100) NULL,
	[SELinuxStatus] [nvarchar](50) NULL,
	[AppArmorStatus] [nvarchar](50) NULL,
	[LastScanAt] [datetime2](7) NULL,
	[FailedLoginCount24h] [int] NULL,
	[UpdatedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[DeviceId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[DeviceServiceSnapshot]    Script Date: 11/4/2026 3:32:11 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[DeviceServiceSnapshot](
	[DeviceId] [varchar](36) NOT NULL,
	[ServicesJson] [nvarchar](max) NOT NULL,
	[UpdatedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[DeviceId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[DeviceSoftwareSnapshot]    Script Date: 11/4/2026 3:32:11 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[DeviceSoftwareSnapshot](
	[DeviceId] [varchar](36) NOT NULL,
	[SoftwareJson] [nvarchar](max) NOT NULL,
	[UpdatedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[DeviceId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[DeviceUpdates]    Script Date: 11/4/2026 3:32:11 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[DeviceUpdates](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[DeviceId] [varchar](36) NOT NULL,
	[UpdateKey] [nvarchar](300) NOT NULL,
	[Title] [nvarchar](500) NOT NULL,
	[Category] [varchar](20) NOT NULL,
	[Severity] [varchar](12) NOT NULL,
	[CurrentVersion] [nvarchar](100) NULL,
	[NewVersion] [nvarchar](100) NULL,
	[SizeMB] [decimal](10, 1) NULL,
	[RequiresReboot] [bit] NOT NULL,
	[IsDisruptive] [bit] NOT NULL,
	[Status] [varchar](12) NOT NULL,
	[FailureMessage] [nvarchar](1000) NULL,
	[FirstSeenAt] [datetime2](7) NOT NULL,
	[LastSeenAt] [datetime2](7) NOT NULL,
	[InstalledAt] [datetime2](7) NULL,
	[IncidentNumber] [varchar](20) NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[DeviceUpdateScans]    Script Date: 11/4/2026 3:32:11 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[DeviceUpdateScans](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[DeviceId] [varchar](36) NOT NULL,
	[ScannedAt] [datetime2](7) NOT NULL,
	[TriggerType] [varchar](20) NOT NULL,
	[Family] [varchar](30) NULL,
	[Supported] [bit] NOT NULL,
	[Complete] [bit] NOT NULL,
	[RebootRequired] [bit] NOT NULL,
	[PendingCount] [int] NOT NULL,
	[SecurityCount] [int] NOT NULL,
	[CriticalCount] [int] NOT NULL,
	[KernelCount] [int] NOT NULL,
	[FirmwareCount] [int] NOT NULL,
	[DriverCount] [int] NOT NULL,
	[ApplicationCount] [int] NOT NULL,
	[PackageCount] [int] NOT NULL,
	[FailedCount] [int] NOT NULL,
	[LastInstalledAt] [varchar](40) NULL,
	[DefinitionsName] [nvarchar](100) NULL,
	[DefinitionsVersion] [nvarchar](100) NULL,
	[DefinitionsAgeDays] [int] NULL,
	[WarningsJson] [nvarchar](max) NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[DeviceUsbEvents]    Script Date: 11/4/2026 3:32:11 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[DeviceUsbEvents](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[DeviceId] [varchar](36) NOT NULL,
	[EventType] [varchar](10) NOT NULL,
	[DeviceName] [nvarchar](200) NULL,
	[VendorId] [varchar](20) NULL,
	[SerialNumber] [nvarchar](100) NULL,
	[StorageCapacityGB] [float] NULL,
	[DetectedAt] [datetime2](7) NOT NULL,
	[VendorName] [nvarchar](150) NULL,
	[ProductId] [varchar](20) NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[DeviceVolumes]    Script Date: 11/4/2026 3:32:11 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[DeviceVolumes](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[DeviceId] [varchar](36) NOT NULL,
	[MountPoint] [nvarchar](260) NOT NULL,
	[Device] [nvarchar](260) NULL,
	[FsType] [varchar](32) NULL,
	[TotalGB] [float] NULL,
	[FreeGB] [float] NULL,
	[UsedPercent] [float] NULL,
	[UpdatedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[DomainCategories]    Script Date: 11/4/2026 3:32:11 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[DomainCategories](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[Name] [nvarchar](100) NOT NULL,
	[RiskLevel] [varchar](20) NOT NULL,
	[IsBuiltIn] [bit] NOT NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[UpdatedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[DomainCategoryRules]    Script Date: 11/4/2026 3:32:11 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[DomainCategoryRules](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[Domain] [nvarchar](255) NOT NULL,
	[CategoryId] [int] NOT NULL,
	[MatchType] [varchar](10) NOT NULL,
	[Source] [varchar](20) NOT NULL,
	[CreatedByUserId] [int] NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[EmailDeliveryLog]    Script Date: 11/4/2026 3:32:11 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[EmailDeliveryLog](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[ToAddress] [nvarchar](200) NOT NULL,
	[Subject] [nvarchar](300) NULL,
	[Success] [bit] NOT NULL,
	[ErrorMessage] [nvarchar](1000) NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[EmailSecurityScans]    Script Date: 11/4/2026 3:32:11 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[EmailSecurityScans](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[WebsiteId] [int] NULL,
	[Domain] [nvarchar](255) NOT NULL,
	[Grade] [varchar](5) NOT NULL,
	[Score] [int] NOT NULL,
	[HasMx] [bit] NOT NULL,
	[HasSpf] [bit] NOT NULL,
	[SpfHardFail] [bit] NOT NULL,
	[HasDkim] [bit] NOT NULL,
	[HasDmarc] [bit] NOT NULL,
	[DmarcPolicy] [varchar](20) NULL,
	[HasBimi] [bit] NOT NULL,
	[HasMtaSts] [bit] NOT NULL,
	[HasTlsRpt] [bit] NOT NULL,
	[ReportJson] [nvarchar](max) NOT NULL,
	[ErrorMessage] [nvarchar](1000) NULL,
	[TriggeredByUserId] [int] NULL,
	[TriggeredByUsername] [nvarchar](100) NULL,
	[ScannedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[EmployeeNotifications]    Script Date: 11/4/2026 3:32:11 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[EmployeeNotifications](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[StaffId] [int] NULL,
	[Message] [nvarchar](500) NOT NULL,
	[SentByUserId] [int] NULL,
	[SentByUsername] [nvarchar](100) NOT NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[EnrollmentTokens]    Script Date: 11/4/2026 3:32:11 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[EnrollmentTokens](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[Token] [varchar](64) NOT NULL,
	[CreatedByUserId] [int] NOT NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[ExpiresAt] [datetime2](7) NOT NULL,
	[UsedAt] [datetime2](7) NULL,
	[UsedByDeviceId] [varchar](36) NULL,
	[PreCreatedDeviceId] [varchar](36) NULL,
	[StaffId] [int] NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY],
UNIQUE NONCLUSTERED 
(
	[Token] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[ExcludedDomains]    Script Date: 11/4/2026 3:32:11 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[ExcludedDomains](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[Domain] [nvarchar](255) NOT NULL,
	[Reason] [varchar](30) NOT NULL,
	[Notes] [nvarchar](500) NULL,
	[AddedByUserId] [int] NOT NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[FileIntegrityEvents]    Script Date: 11/4/2026 3:32:11 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[FileIntegrityEvents](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[DeviceId] [varchar](36) NOT NULL,
	[FilePath] [nvarchar](500) NOT NULL,
	[ChangeType] [varchar](20) NOT NULL,
	[ModifiedBy] [nvarchar](200) NULL,
	[OldHash] [varchar](64) NULL,
	[NewHash] [varchar](64) NULL,
	[OldValue] [nvarchar](max) NULL,
	[NewValue] [nvarchar](max) NULL,
	[DetectedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[HelpArticleFeedback]    Script Date: 11/4/2026 3:32:11 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[HelpArticleFeedback](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[ArticleId] [int] NOT NULL,
	[UserId] [int] NULL,
	[WasHelpful] [bit] NOT NULL,
	[Comment] [nvarchar](1000) NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[HelpArticles]    Script Date: 11/4/2026 3:32:11 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[HelpArticles](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[Slug] [nvarchar](200) NOT NULL,
	[Type] [varchar](20) NOT NULL,
	[CategoryKey] [varchar](50) NULL,
	[GroupKey] [varchar](50) NULL,
	[ItemKey] [varchar](50) NULL,
	[AppliesToRoute] [nvarchar](300) NULL,
	[Title] [nvarchar](200) NOT NULL,
	[Summary] [nvarchar](500) NULL,
	[BodyMarkdown] [nvarchar](max) NOT NULL,
	[Tags] [nvarchar](300) NULL,
	[Status] [varchar](20) NOT NULL,
	[RequiredPermissionKey] [varchar](50) NULL,
	[LastEditedByUserId] [int] NULL,
	[LastEditedByName] [nvarchar](100) NULL,
	[LastReviewedAt] [datetime2](7) NULL,
	[ReviewDueAt] [datetime2](7) NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[UpdatedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[IisAppPools]    Script Date: 11/4/2026 3:32:11 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[IisAppPools](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[DeviceId] [varchar](36) NOT NULL,
	[Name] [nvarchar](200) NOT NULL,
	[State] [varchar](20) NOT NULL,
	[UpdatedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[IisPerfSnapshots]    Script Date: 11/4/2026 3:32:11 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[IisPerfSnapshots](
	[Id] [bigint] IDENTITY(1,1) NOT NULL,
	[DeviceId] [varchar](36) NOT NULL,
	[ReceivedAt] [datetime2](7) NOT NULL,
	[WebServiceRequestsPerSec] [float] NULL,
	[CurrentConnections] [int] NULL,
	[AspNetRequestsPerSec] [float] NULL,
	[FailedRequestTraceCount] [int] NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[IisSites]    Script Date: 11/4/2026 3:32:11 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[IisSites](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[DeviceId] [varchar](36) NOT NULL,
	[SiteName] [nvarchar](200) NOT NULL,
	[State] [varchar](20) NOT NULL,
	[Bindings] [nvarchar](500) NULL,
	[IsAvailable] [bit] NOT NULL,
	[LastStatusCode] [int] NULL,
	[LastResponseTimeMs] [float] NULL,
	[SslExpiresAt] [datetime2](7) NULL,
	[UpdatedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[IisWorkerProcesses]    Script Date: 11/4/2026 3:32:11 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[IisWorkerProcesses](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[DeviceId] [varchar](36) NOT NULL,
	[ProcessId] [int] NOT NULL,
	[AppPoolName] [nvarchar](200) NULL,
	[PrivateBytesMB] [float] NULL,
	[CpuPercent] [float] NULL,
	[UpdatedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[InAppNotifications]    Script Date: 11/4/2026 3:32:11 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[InAppNotifications](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[UserId] [int] NOT NULL,
	[EventType] [varchar](40) NULL,
	[Subject] [nvarchar](300) NULL,
	[Body] [nvarchar](1000) NULL,
	[MonitorId] [int] NULL,
	[IncidentId] [int] NULL,
	[IsRead] [bit] NOT NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[IncidentCounters]    Script Date: 11/4/2026 3:32:11 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[IncidentCounters](
	[CounterYear] [int] NOT NULL,
	[LastNumber] [int] NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[CounterYear] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[IncidentEscalations]    Script Date: 11/4/2026 3:32:11 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[IncidentEscalations](
	[IncidentId] [int] NOT NULL,
	[StepId] [int] NOT NULL,
	[FiredAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[IncidentId] ASC,
	[StepId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[IncidentNotes]    Script Date: 11/4/2026 3:32:11 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[IncidentNotes](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[IncidentId] [int] NOT NULL,
	[UserId] [int] NOT NULL,
	[Note] [nvarchar](2000) NOT NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[IncidentReports]    Script Date: 11/4/2026 3:32:12 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[IncidentReports](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[Title] [nvarchar](255) NOT NULL,
	[FileName] [nvarchar](255) NOT NULL,
	[FilePath] [nvarchar](500) NOT NULL,
	[FileSizeBytes] [bigint] NOT NULL,
	[UploadedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Incidents]    Script Date: 11/4/2026 3:32:12 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Incidents](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[MonitorId] [int] NOT NULL,
	[Title] [nvarchar](300) NOT NULL,
	[Severity] [varchar](20) NOT NULL,
	[Status] [varchar](20) NOT NULL,
	[FailureReason] [nvarchar](500) NULL,
	[HttpStatusCode] [int] NULL,
	[StartedAt] [datetime2](7) NOT NULL,
	[ResolvedAt] [datetime2](7) NULL,
	[DowntimeSeconds] [int] NULL,
	[AssignedToUserId] [int] NULL,
	[AcknowledgedAt] [datetime2](7) NULL,
	[AcknowledgedByUserId] [int] NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[IncidentTimeline]    Script Date: 11/4/2026 3:32:12 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[IncidentTimeline](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[IncidentId] [int] NOT NULL,
	[StepType] [varchar](20) NOT NULL,
	[Summary] [nvarchar](1000) NOT NULL,
	[DeviceId] [varchar](36) NULL,
	[DeviceLabel] [nvarchar](200) NULL,
	[UpdateKey] [nvarchar](300) NULL,
	[EntryId] [int] NULL,
	[TaskId] [int] NULL,
	[StaffName] [nvarchar](200) NULL,
	[ActorName] [nvarchar](100) NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Integrations]    Script Date: 11/4/2026 3:32:12 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Integrations](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[ProviderKey] [nvarchar](50) NOT NULL,
	[Enabled] [bit] NOT NULL,
	[ConfigJson] [nvarchar](max) NULL,
	[UpdatedAt] [datetime2](7) NOT NULL,
	[UpdatedByUserId] [int] NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY],
UNIQUE NONCLUSTERED 
(
	[ProviderKey] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[ItAssetImportHistory]    Script Date: 11/4/2026 3:32:12 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[ItAssetImportHistory](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[TargetTable] [varchar](30) NOT NULL,
	[FileName] [nvarchar](300) NOT NULL,
	[TotalRows] [int] NOT NULL,
	[ImportedRows] [int] NOT NULL,
	[FailedRows] [int] NOT NULL,
	[ErrorReportJson] [nvarchar](max) NULL,
	[ImportedByUserId] [int] NULL,
	[ImportedByUsername] [nvarchar](100) NULL,
	[ImportedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[ItAssetLookupValues]    Script Date: 11/4/2026 3:32:12 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[ItAssetLookupValues](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[Category] [varchar](50) NOT NULL,
	[Value] [nvarchar](200) NOT NULL,
	[SortOrder] [int] NOT NULL,
	[IsActive] [bit] NOT NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[CreatedByUserId] [int] NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY],
 CONSTRAINT [UQ_ItAssetLookupValues_Category_Value] UNIQUE NONCLUSTERED 
(
	[Category] ASC,
	[Value] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[ItAssetNotifications]    Script Date: 11/4/2026 3:32:12 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[ItAssetNotifications](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[AlertType] [varchar](40) NOT NULL,
	[AssetId] [int] NULL,
	[SourceTable] [varchar](30) NULL,
	[SourceRecordId] [int] NULL,
	[Severity] [varchar](20) NOT NULL,
	[Title] [nvarchar](300) NOT NULL,
	[Message] [nvarchar](1000) NULL,
	[IsRead] [bit] NOT NULL,
	[ReadByUserId] [int] NULL,
	[ReadAt] [datetime2](7) NULL,
	[EmailSentAt] [datetime2](7) NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[ItAssetSettings]    Script Date: 11/4/2026 3:32:12 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[ItAssetSettings](
	[Id] [int] NOT NULL,
	[PasswordDueSoonDays] [int] NOT NULL,
	[PatchDueSoonDays] [int] NOT NULL,
	[MaintenanceDueSoonDays] [int] NOT NULL,
	[WarrantyExpiryWarningDays] [int] NOT NULL,
	[LicenceExpiryWarningDays] [int] NOT NULL,
	[InventoryCheckIntervalDays] [int] NOT NULL,
	[NotificationRecipientsJson] [nvarchar](max) NULL,
	[NotificationFrequency] [varchar](20) NOT NULL,
	[EscalationRecipientsJson] [nvarchar](max) NULL,
	[EscalationAfterDays] [int] NULL,
	[CriticalAssetsAlertImmediately] [bit] NOT NULL,
	[EmailAlertsEnabled] [bit] NOT NULL,
	[UpdatedAt] [datetime2](7) NOT NULL,
	[UpdatedByUserId] [int] NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[JobDesignations]    Script Date: 11/4/2026 3:32:12 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[JobDesignations](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[Title] [nvarchar](150) NOT NULL,
	[Description] [nvarchar](500) NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[UpdatedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[KnowledgeBaseDocuments]    Script Date: 11/4/2026 3:32:12 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[KnowledgeBaseDocuments](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[Title] [nvarchar](200) NOT NULL,
	[Description] [nvarchar](2000) NULL,
	[Category] [varchar](50) NOT NULL,
	[Tags] [nvarchar](300) NULL,
	[FilePath] [nvarchar](500) NOT NULL,
	[OriginalFileName] [nvarchar](255) NOT NULL,
	[ContentType] [nvarchar](150) NULL,
	[SizeBytes] [int] NOT NULL,
	[UploadedByUserId] [int] NULL,
	[UploadedByName] [nvarchar](100) NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[UpdatedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[LaravelSecurityIssues]    Script Date: 11/4/2026 3:32:12 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[LaravelSecurityIssues](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[IssueNumber] [nvarchar](20) NULL,
	[ProjectId] [int] NOT NULL,
	[ScanId] [int] NOT NULL,
	[Category] [varchar](30) NOT NULL,
	[RuleCode] [nvarchar](100) NULL,
	[Title] [nvarchar](300) NOT NULL,
	[Description] [nvarchar](2000) NULL,
	[FilePath] [nvarchar](1000) NOT NULL,
	[StartLine] [int] NULL,
	[EndLine] [int] NULL,
	[CodeElement] [nvarchar](300) NULL,
	[Severity] [varchar](20) NOT NULL,
	[Status] [varchar](20) NOT NULL,
	[ConfidenceLevel] [varchar](20) NULL,
	[Recommendation] [nvarchar](2000) NULL,
	[CodeSnippet] [nvarchar](max) NULL,
	[ResolutionNote] [nvarchar](2000) NULL,
	[ResolvedByUserId] [int] NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[UpdatedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[LaravelSecurityProjects]    Script Date: 11/4/2026 3:32:12 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[LaravelSecurityProjects](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[Name] [nvarchar](200) NOT NULL,
	[Description] [nvarchar](1000) NULL,
	[RepositoryUrl] [nvarchar](500) NULL,
	[SourcePath] [nvarchar](1000) NOT NULL,
	[DefaultBranch] [nvarchar](200) NULL,
	[LaravelVersion] [nvarchar](50) NULL,
	[ScanConfig] [nvarchar](max) NULL,
	[Status] [varchar](20) NOT NULL,
	[RepoConnectionId] [int] NULL,
	[RepoProvider] [varchar](20) NULL,
	[RepositoryOwner] [nvarchar](200) NULL,
	[RepositoryName] [nvarchar](200) NULL,
	[RepositoryRef] [nvarchar](200) NULL,
	[LastSyncedCommitSha] [nvarchar](64) NULL,
	[LastSyncedAt] [datetime2](7) NULL,
	[CreatedByUserId] [int] NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[UpdatedAt] [datetime2](7) NOT NULL,
	[DeletedAt] [datetime2](7) NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[LaravelSecurityRules]    Script Date: 11/4/2026 3:32:12 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[LaravelSecurityRules](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[RuleCode] [nvarchar](100) NOT NULL,
	[RuleName] [nvarchar](200) NOT NULL,
	[Description] [nvarchar](1000) NULL,
	[Category] [varchar](30) NOT NULL,
	[DefaultSeverity] [varchar](20) NOT NULL,
	[Enabled] [bit] NOT NULL,
	[Configuration] [nvarchar](max) NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[UpdatedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY],
UNIQUE NONCLUSTERED 
(
	[RuleCode] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[LaravelSecurityScanLog]    Script Date: 11/4/2026 3:32:12 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[LaravelSecurityScanLog](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[ScanId] [int] NOT NULL,
	[Message] [nvarchar](1000) NOT NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[LaravelSecurityScans]    Script Date: 11/4/2026 3:32:12 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[LaravelSecurityScans](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[ProjectId] [int] NOT NULL,
	[Branch] [nvarchar](200) NULL,
	[ScanType] [varchar](20) NOT NULL,
	[Status] [varchar](20) NOT NULL,
	[StartedByUserId] [int] NULL,
	[StartedAt] [datetime2](7) NULL,
	[CompletedAt] [datetime2](7) NULL,
	[DurationMs] [int] NULL,
	[FilesScanned] [int] NOT NULL,
	[SecurityScore] [int] NULL,
	[ErrorMessage] [nvarchar](2000) NULL,
	[ConfigSnapshot] [nvarchar](max) NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[LaravelSecuritySettings]    Script Date: 11/4/2026 3:32:12 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[LaravelSecuritySettings](
	[Id] [int] NOT NULL,
	[WeightAppDebug] [float] NOT NULL,
	[WeightAppKey] [float] NOT NULL,
	[WeightDotEnv] [float] NOT NULL,
	[WeightCsrf] [float] NOT NULL,
	[WeightMassAssignment] [float] NOT NULL,
	[WeightValidation] [float] NOT NULL,
	[WeightSanitization] [float] NOT NULL,
	[WeightStorageLinks] [float] NOT NULL,
	[WeightQueue] [float] NOT NULL,
	[PointsPerIssueLow] [float] NOT NULL,
	[PointsPerIssueMedium] [float] NOT NULL,
	[PointsPerIssueHigh] [float] NOT NULL,
	[PointsPerIssueCritical] [float] NOT NULL,
	[ExcludedDirectories] [nvarchar](max) NULL,
	[AllowedExtensions] [nvarchar](500) NOT NULL,
	[MaxScanSizeMb] [int] NOT NULL,
	[ScanTimeoutSeconds] [int] NOT NULL,
	[RetentionDays] [int] NOT NULL,
	[UpdatedAt] [datetime2](7) NOT NULL,
	[UpdatedByUserId] [int] NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[LinuxFail2banJails]    Script Date: 11/4/2026 3:32:12 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[LinuxFail2banJails](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[DeviceId] [varchar](36) NOT NULL,
	[JailName] [nvarchar](100) NOT NULL,
	[CurrentlyBanned] [int] NOT NULL,
	[TotalBanned] [int] NOT NULL,
	[UpdatedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[LinuxOpenPorts]    Script Date: 11/4/2026 3:32:12 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[LinuxOpenPorts](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[DeviceId] [varchar](36) NOT NULL,
	[Protocol] [varchar](10) NOT NULL,
	[Address] [varchar](64) NOT NULL,
	[Port] [int] NOT NULL,
	[ProcessName] [nvarchar](200) NULL,
	[UpdatedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[LinuxPermissionFindings]    Script Date: 11/4/2026 3:32:12 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[LinuxPermissionFindings](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[DeviceId] [varchar](36) NOT NULL,
	[IssueType] [varchar](20) NOT NULL,
	[Path] [nvarchar](500) NOT NULL,
	[UpdatedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[LinuxSecurityStatus]    Script Date: 11/4/2026 3:32:12 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[LinuxSecurityStatus](
	[DeviceId] [varchar](36) NOT NULL,
	[SshPort] [int] NULL,
	[SshPermitRootLogin] [varchar](30) NULL,
	[SshPasswordAuthentication] [varchar](20) NULL,
	[SshServiceActive] [bit] NULL,
	[FirewallType] [varchar](20) NULL,
	[FirewallActive] [bit] NULL,
	[FirewallRuleCount] [int] NULL,
	[Fail2banInstalled] [bit] NULL,
	[Fail2banActive] [bit] NULL,
	[SelinuxStatus] [varchar](20) NULL,
	[ApparmorStatus] [varchar](20) NULL,
	[ApparmorEnforceCount] [int] NULL,
	[ApparmorComplainCount] [int] NULL,
	[WorldWritableFileCount] [int] NULL,
	[SuidBinaryCount] [int] NULL,
	[SudoNopasswdCount] [int] NULL,
	[UpdatedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[DeviceId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[LinuxSudoNopasswdEntries]    Script Date: 11/4/2026 3:32:12 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[LinuxSudoNopasswdEntries](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[DeviceId] [varchar](36) NOT NULL,
	[Entry] [nvarchar](500) NOT NULL,
	[UpdatedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[LoginActivity]    Script Date: 11/4/2026 3:32:12 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[LoginActivity](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[UserId] [int] NULL,
	[Username] [nvarchar](100) NOT NULL,
	[IpAddress] [nvarchar](100) NULL,
	[UserAgent] [nvarchar](500) NULL,
	[Success] [bit] NOT NULL,
	[FailureReason] [nvarchar](200) NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[MailBlockingPolicies]    Script Date: 11/4/2026 3:32:12 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[MailBlockingPolicies](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[Name] [nvarchar](200) NOT NULL,
	[Description] [nvarchar](1000) NULL,
	[Enabled] [bit] NOT NULL,
	[Mandatory] [bit] NOT NULL,
	[Direction] [varchar](20) NOT NULL,
	[Priority] [int] NOT NULL,
	[Action] [varchar](20) NOT NULL,
	[RulesJson] [nvarchar](max) NOT NULL,
	[UrlPatternsJson] [nvarchar](max) NULL,
	[NotifySender] [bit] NOT NULL,
	[NotifyRecipient] [bit] NOT NULL,
	[NotifyAdminEmail] [nvarchar](320) NULL,
	[CreatedByUserId] [int] NULL,
	[UpdatedByUserId] [int] NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[UpdatedAt] [datetime2](7) NOT NULL,
	[DeletedAt] [datetime2](7) NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[MailIncidentAttachments]    Script Date: 11/4/2026 3:32:12 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[MailIncidentAttachments](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[IncidentId] [int] NOT NULL,
	[FileName] [nvarchar](500) NOT NULL,
	[DeclaredExtension] [nvarchar](20) NULL,
	[DetectedFileType] [nvarchar](100) NULL,
	[MimeType] [nvarchar](150) NULL,
	[FileHash] [char](64) NULL,
	[FileSizeBytes] [bigint] NULL,
	[InspectionResultJson] [nvarchar](max) NULL,
	[Blocked] [bit] NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[MailIncidentUrls]    Script Date: 11/4/2026 3:32:12 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[MailIncidentUrls](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[IncidentId] [int] NOT NULL,
	[OriginalUrl] [nvarchar](1000) NOT NULL,
	[ResolvedUrl] [nvarchar](1000) NULL,
	[Domain] [nvarchar](300) NULL,
	[CloudProvider] [nvarchar](100) NULL,
	[Blocked] [bit] NOT NULL,
	[Reason] [nvarchar](300) NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[MailNotificationTemplates]    Script Date: 11/4/2026 3:32:12 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[MailNotificationTemplates](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[EventType] [varchar](40) NOT NULL,
	[Subject] [nvarchar](300) NOT NULL,
	[Body] [nvarchar](max) NOT NULL,
	[UpdatedByUserId] [int] NULL,
	[UpdatedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY],
UNIQUE NONCLUSTERED 
(
	[EventType] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[MailPolicyExceptions]    Script Date: 11/4/2026 3:32:12 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[MailPolicyExceptions](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[PolicyId] [int] NULL,
	[ExceptionType] [varchar](30) NOT NULL,
	[ExceptionValue] [nvarchar](500) NOT NULL,
	[Reason] [nvarchar](500) NOT NULL,
	[ApprovedByUserId] [int] NOT NULL,
	[ExpiresAt] [datetime2](7) NULL,
	[RevokedAt] [datetime2](7) NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[MailPolicyScopes]    Script Date: 11/4/2026 3:32:12 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[MailPolicyScopes](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[PolicyId] [int] NOT NULL,
	[ScopeType] [varchar](20) NOT NULL,
	[ScopeValue] [nvarchar](300) NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[MailProviderConnections]    Script Date: 11/4/2026 3:32:12 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[MailProviderConnections](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[ProviderType] [varchar](30) NOT NULL,
	[DisplayName] [nvarchar](200) NOT NULL,
	[Status] [varchar](20) NOT NULL,
	[ConfigJson] [nvarchar](max) NULL,
	[EncryptedSecret] [nvarchar](500) NULL,
	[LastTestedAt] [datetime2](7) NULL,
	[LastTestResult] [nvarchar](500) NULL,
	[IsActive] [bit] NOT NULL,
	[CreatedByUserId] [int] NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[UpdatedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[MailSecurityIncidents]    Script Date: 11/4/2026 3:32:12 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[MailSecurityIncidents](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[IncidentId] [uniqueidentifier] NOT NULL,
	[Source] [varchar](20) NOT NULL,
	[ProviderConnectionId] [int] NULL,
	[Direction] [varchar](20) NOT NULL,
	[Sender] [nvarchar](320) NOT NULL,
	[Recipients] [nvarchar](2000) NOT NULL,
	[Subject] [nvarchar](500) NULL,
	[MatchedPolicyId] [int] NULL,
	[ActionTaken] [varchar](20) NOT NULL,
	[BlockReason] [nvarchar](500) NULL,
	[ExceptionUsedId] [int] NULL,
	[NotificationStatus] [nvarchar](200) NULL,
	[ProcessingTimeMs] [int] NULL,
	[ErrorDetails] [nvarchar](1000) NULL,
	[DetectedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[MaintenanceLogs]    Script Date: 11/4/2026 3:32:12 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[MaintenanceLogs](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[AssetId] [int] NOT NULL,
	[ActivityType] [varchar](30) NOT NULL,
	[ActivityTitle] [nvarchar](300) NOT NULL,
	[Description] [nvarchar](max) NULL,
	[ScheduledDate] [date] NULL,
	[StartAt] [datetime2](7) NULL,
	[CompletedAt] [datetime2](7) NULL,
	[Status] [varchar](20) NOT NULL,
	[Priority] [varchar](10) NOT NULL,
	[PerformedBy] [nvarchar](200) NULL,
	[RequestedBy] [nvarchar](200) NULL,
	[ApprovedBy] [nvarchar](200) NULL,
	[DowntimeMinutes] [int] NULL,
	[ServiceImpact] [nvarchar](500) NULL,
	[ChangeRequestNumber] [nvarchar](100) NULL,
	[IncidentNumber] [nvarchar](100) NULL,
	[Result] [nvarchar](1000) NULL,
	[FollowUpRequired] [bit] NOT NULL,
	[FollowUpDate] [date] NULL,
	[Notes] [nvarchar](max) NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[CreatedByUserId] [int] NULL,
	[CreatedByUsername] [nvarchar](100) NULL,
	[UpdatedAt] [datetime2](7) NOT NULL,
	[UpdatedByUserId] [int] NULL,
	[UpdatedByUsername] [nvarchar](100) NULL,
	[IsDeleted] [bit] NOT NULL,
	[DeletedAt] [datetime2](7) NULL,
	[DeletedByUserId] [int] NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[MaintenanceWindowMonitors]    Script Date: 11/4/2026 3:32:12 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[MaintenanceWindowMonitors](
	[MaintenanceWindowId] [int] NOT NULL,
	[MonitorId] [int] NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[MaintenanceWindowId] ASC,
	[MonitorId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[MaintenanceWindows]    Script Date: 11/4/2026 3:32:12 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[MaintenanceWindows](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[Name] [nvarchar](200) NOT NULL,
	[Description] [nvarchar](1000) NULL,
	[StartsAt] [datetime2](7) NOT NULL,
	[EndsAt] [datetime2](7) NOT NULL,
	[IsRecurring] [bit] NOT NULL,
	[RecurrenceRule] [varchar](20) NULL,
	[IsActive] [bit] NOT NULL,
	[CreatedByUserId] [int] NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[MalwareFindings]    Script Date: 11/4/2026 3:32:12 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[MalwareFindings](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[DeviceId] [varchar](36) NULL,
	[ScanId] [int] NOT NULL,
	[CheckType] [varchar](30) NOT NULL,
	[Severity] [varchar](20) NOT NULL,
	[FilePath] [nvarchar](1000) NOT NULL,
	[LineNumber] [int] NULL,
	[Snippet] [nvarchar](1000) NULL,
	[Status] [varchar](20) NOT NULL,
	[FirstDetectedAt] [datetime2](7) NOT NULL,
	[LastSeenAt] [datetime2](7) NOT NULL,
	[ResolvedByUserId] [int] NULL,
	[ResolutionNote] [nvarchar](1000) NULL,
	[WebsiteId] [int] NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[MalwareScans]    Script Date: 11/4/2026 3:32:12 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[MalwareScans](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[DeviceId] [varchar](36) NULL,
	[StartedAt] [datetime2](7) NOT NULL,
	[CompletedAt] [datetime2](7) NULL,
	[Status] [varchar](20) NOT NULL,
	[RootsScanned] [int] NOT NULL,
	[FilesScanned] [int] NOT NULL,
	[FindingsCount] [int] NOT NULL,
	[ErrorMessage] [nvarchar](2000) NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[WebsiteId] [int] NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[MobileDevicePolicy]    Script Date: 11/4/2026 3:32:12 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[MobileDevicePolicy](
	[Id] [int] NOT NULL,
	[AutoBlockNewMobileDevices] [bit] NOT NULL,
	[UpdatedAt] [datetime2](7) NOT NULL,
	[UpdatedByUserId] [int] NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[MobileInternetControl]    Script Date: 11/4/2026 3:32:12 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[MobileInternetControl](
	[MacAddress] [varchar](17) NOT NULL,
	[Blocked] [bit] NOT NULL,
	[UpdatedAt] [datetime2](7) NOT NULL,
	[UpdatedByUserId] [int] NULL,
	[BlockScheduleId] [int] NULL,
	[AllowScheduleId] [int] NULL,
PRIMARY KEY CLUSTERED 
(
	[MacAddress] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[MonitoringSettings]    Script Date: 11/4/2026 3:32:12 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[MonitoringSettings](
	[Id] [int] NOT NULL,
	[DefaultIntervalSeconds] [int] NOT NULL,
	[DefaultTimeoutMs] [int] NOT NULL,
	[DefaultFailureConfirmCount] [int] NOT NULL,
	[DefaultRecoveryConfirmCount] [int] NOT NULL,
	[DefaultResponseWarningMs] [int] NOT NULL,
	[DefaultResponseCriticalMs] [int] NOT NULL,
	[DefaultAlertPolicyId] [int] NULL,
	[DataRetentionDays] [int] NOT NULL,
	[MaxResponseSizeBytes] [bigint] NOT NULL,
	[DefaultUserAgent] [nvarchar](300) NOT NULL,
	[BlockPrivateNetworks] [bit] NOT NULL,
	[MaxRedirects] [int] NOT NULL,
	[AggregateRetentionDays] [int] NOT NULL,
 CONSTRAINT [PK_MonitoringSettings] PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[MonitorMetricsDaily]    Script Date: 11/4/2026 3:32:12 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[MonitorMetricsDaily](
	[MonitorId] [int] NOT NULL,
	[PeriodStart] [datetime2](7) NOT NULL,
	[TotalChecks] [int] NOT NULL,
	[SuccessfulChecks] [int] NOT NULL,
	[AvgMs] [float] NULL,
	[MinMs] [int] NULL,
	[MaxMs] [int] NULL,
	[P95Ms] [float] NULL,
 CONSTRAINT [PK_MonitorMetricsDaily] PRIMARY KEY CLUSTERED 
(
	[MonitorId] ASC,
	[PeriodStart] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[MonitorMetricsHourly]    Script Date: 11/4/2026 3:32:12 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[MonitorMetricsHourly](
	[MonitorId] [int] NOT NULL,
	[PeriodStart] [datetime2](7) NOT NULL,
	[TotalChecks] [int] NOT NULL,
	[SuccessfulChecks] [int] NOT NULL,
	[AvgMs] [float] NULL,
	[MinMs] [int] NULL,
	[MaxMs] [int] NULL,
	[P95Ms] [float] NULL,
 CONSTRAINT [PK_MonitorMetricsHourly] PRIMARY KEY CLUSTERED 
(
	[MonitorId] ASC,
	[PeriodStart] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[MonitorResults]    Script Date: 11/4/2026 3:32:12 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[MonitorResults](
	[Id] [bigint] IDENTITY(1,1) NOT NULL,
	[MonitorId] [int] NOT NULL,
	[CheckedAt] [datetime2](7) NOT NULL,
	[Success] [bit] NOT NULL,
	[HttpStatusCode] [int] NULL,
	[DnsMs] [int] NULL,
	[TcpMs] [int] NULL,
	[TlsMs] [int] NULL,
	[TtfbMs] [int] NULL,
	[TotalMs] [int] NULL,
	[ResponseSizeBytes] [bigint] NULL,
	[RedirectCount] [int] NULL,
	[FinalUrl] [nvarchar](2000) NULL,
	[ContentCheckResultJson] [nvarchar](max) NULL,
	[ErrorCode] [varchar](50) NULL,
	[ErrorMessage] [nvarchar](1000) NULL,
	[RegionCheckResultsJson] [nvarchar](max) NULL,
	[AssertionResultsJson] [nvarchar](max) NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Monitors]    Script Date: 11/4/2026 3:32:12 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Monitors](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[MonitorType] [varchar](20) NOT NULL,
	[Name] [nvarchar](200) NOT NULL,
	[Description] [nvarchar](1000) NULL,
	[Environment] [varchar](50) NULL,
	[Tags] [nvarchar](500) NULL,
	[IntervalSeconds] [int] NOT NULL,
	[TimeoutMs] [int] NOT NULL,
	[FailureConfirmCount] [int] NOT NULL,
	[RecoveryConfirmCount] [int] NOT NULL,
	[AlertPolicyId] [int] NULL,
	[Status] [varchar](20) NOT NULL,
	[ConsecutiveFailures] [int] NOT NULL,
	[ConsecutiveSuccesses] [int] NOT NULL,
	[IsActive] [bit] NOT NULL,
	[LastCheckedAt] [datetime2](7) NULL,
	[NextCheckAt] [datetime2](7) NOT NULL,
	[CreatedByUserId] [int] NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[UpdatedByUserId] [int] NULL,
	[UpdatedAt] [datetime2](7) NOT NULL,
	[IsDeleted] [bit] NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[NetworkDiagramDesigns]    Script Date: 11/4/2026 3:32:12 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[NetworkDiagramDesigns](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[Name] [nvarchar](200) NOT NULL,
	[Description] [nvarchar](1000) NULL,
	[DiagramJson] [nvarchar](max) NOT NULL,
	[Status] [varchar](20) NOT NULL,
	[OwnerUserId] [int] NOT NULL,
	[CreatedByUserId] [int] NOT NULL,
	[UpdatedByUserId] [int] NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[UpdatedAt] [datetime2](7) NOT NULL,
	[DeletedAt] [datetime2](7) NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[NetworkDiagrams]    Script Date: 11/4/2026 3:32:12 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[NetworkDiagrams](
	[Id] [int] NOT NULL,
	[Name] [nvarchar](200) NOT NULL,
	[DiagramJson] [nvarchar](max) NULL,
	[UpdatedAt] [datetime2](7) NOT NULL,
	[UpdatedByUserId] [int] NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[NotificationLogs]    Script Date: 11/4/2026 3:32:13 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[NotificationLogs](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[EventType] [varchar](40) NOT NULL,
	[MonitorId] [int] NULL,
	[IncidentId] [int] NULL,
	[AlertContactId] [int] NULL,
	[Subject] [nvarchar](300) NULL,
	[Provider] [varchar](20) NOT NULL,
	[Status] [varchar](20) NOT NULL,
	[SentAt] [datetime2](7) NULL,
	[FailureReason] [nvarchar](500) NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[Body] [nvarchar](max) NULL,
	[RetryCount] [int] NOT NULL,
	[NextRetryAt] [datetime2](7) NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[NotificationPreferences]    Script Date: 11/4/2026 3:32:13 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[NotificationPreferences](
	[Id] [int] NOT NULL,
	[EmailEnabled] [bit] NOT NULL,
	[SmsEnabled] [bit] NOT NULL,
	[PushEnabled] [bit] NOT NULL,
	[InAppEnabled] [bit] NOT NULL,
	[UpdatedAt] [datetime2](7) NOT NULL,
	[UpdatedByUserId] [int] NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[NotificationRecipients]    Script Date: 11/4/2026 3:32:13 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[NotificationRecipients](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[ModuleKey] [varchar](50) NOT NULL,
	[SubModuleKey] [varchar](50) NOT NULL,
	[Recipients] [nvarchar](1000) NOT NULL,
	[Enabled] [bit] NOT NULL,
	[UpdatedAt] [datetime2](7) NOT NULL,
	[UpdatedByUserId] [int] NULL,
	[ModuleLabel] [nvarchar](200) NULL,
	[SubModuleLabel] [nvarchar](200) NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY],
 CONSTRAINT [UQ_NotificationRecipients_Module] UNIQUE NONCLUSTERED 
(
	[ModuleKey] ASC,
	[SubModuleKey] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[NotificationRules]    Script Date: 11/4/2026 3:32:13 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[NotificationRules](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[EventName] [nvarchar](100) NOT NULL,
	[EmailEnabled] [bit] NOT NULL,
	[SmsEnabled] [bit] NOT NULL,
	[PushEnabled] [bit] NOT NULL,
	[InAppEnabled] [bit] NOT NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[UpdatedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY],
UNIQUE NONCLUSTERED 
(
	[EventName] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[NotificationTemplates]    Script Date: 11/4/2026 3:32:13 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[NotificationTemplates](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[Key] [nvarchar](100) NOT NULL,
	[Subject] [nvarchar](300) NULL,
	[Body] [nvarchar](max) NULL,
	[IsSystem] [bit] NOT NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[UpdatedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY],
UNIQUE NONCLUSTERED 
(
	[Key] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[NvrCameras]    Script Date: 11/4/2026 3:32:13 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[NvrCameras](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[NvrId] [int] NOT NULL,
	[ProfileToken] [nvarchar](200) NOT NULL,
	[ChannelName] [nvarchar](150) NOT NULL,
	[SnapshotUri] [nvarchar](1000) NULL,
	[StreamUri] [nvarchar](1000) NULL,
	[Status] [nvarchar](20) NOT NULL,
	[LastSeenAt] [datetime2](7) NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[ChannelNumber] [int] NULL,
	[Label] [nvarchar](150) NULL,
	[Location] [nvarchar](150) NULL,
	[SortOrder] [int] NOT NULL,
	[VideoCodec] [nvarchar](20) NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY],
 CONSTRAINT [UQ_NvrCameras_NvrId_ProfileToken] UNIQUE NONCLUSTERED 
(
	[NvrId] ASC,
	[ProfileToken] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[NvrDevices]    Script Date: 11/4/2026 3:32:13 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[NvrDevices](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[Name] [nvarchar](100) NOT NULL,
	[IpAddress] [nvarchar](45) NOT NULL,
	[Port] [int] NOT NULL,
	[Username] [nvarchar](100) NOT NULL,
	[Password] [nvarchar](500) NOT NULL,
	[OnvifPath] [nvarchar](200) NOT NULL,
	[Status] [nvarchar](20) NOT NULL,
	[LastSyncedAt] [datetime2](7) NULL,
	[LastError] [nvarchar](500) NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[RtspPort] [int] NOT NULL,
	[RtspUsername] [nvarchar](100) NULL,
	[RtspPassword] [nvarchar](500) NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[OffboardingActions]    Script Date: 11/4/2026 3:32:13 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[OffboardingActions](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[StaffId] [int] NOT NULL,
	[InitiatedByUserId] [int] NOT NULL,
	[InitiatedByUsername] [nvarchar](100) NOT NULL,
	[GitLabStatus] [nvarchar](30) NOT NULL,
	[GitLabDetail] [nvarchar](max) NULL,
	[GitLabCompletedAt] [datetime2](7) NULL,
	[GlesysStatus] [nvarchar](30) NOT NULL,
	[GlesysDetail] [nvarchar](max) NULL,
	[GlesysNewPasswordEncrypted] [nvarchar](max) NULL,
	[GlesysCompletedAt] [datetime2](7) NULL,
	[OverallStatus] [nvarchar](30) NOT NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[UpdatedAt] [datetime2](7) NOT NULL,
	[AgentQaStatus] [nvarchar](30) NOT NULL,
	[AgentQaDetail] [nvarchar](max) NULL,
	[AgentQaCompletedAt] [datetime2](7) NULL,
	[TeamworkStatus] [nvarchar](30) NOT NULL,
	[TeamworkDetail] [nvarchar](max) NULL,
	[TeamworkCompletedAt] [datetime2](7) NULL,
	[TeamworkRequestId] [uniqueidentifier] NOT NULL,
	[LogMonitorStatus] [nvarchar](30) NOT NULL,
	[LogMonitorDetail] [nvarchar](max) NULL,
	[LogMonitorCompletedAt] [datetime2](7) NULL,
	[ActiveDirectoryStatus] [nvarchar](30) NOT NULL,
	[ActiveDirectoryDetail] [nvarchar](max) NULL,
	[ActiveDirectoryCompletedAt] [datetime2](7) NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[OffboardingSettings]    Script Date: 11/4/2026 3:32:13 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[OffboardingSettings](
	[Id] [int] NOT NULL,
	[GitLabBaseUrl] [nvarchar](500) NULL,
	[GitLabEncryptedToken] [nvarchar](max) NULL,
	[GlesysApiUser] [nvarchar](200) NULL,
	[GlesysEncryptedApiKey] [nvarchar](max) NULL,
	[UpdatedAt] [datetime2](7) NOT NULL,
	[UpdatedByUserId] [int] NULL,
	[AgentQaApiUrl] [nvarchar](500) NULL,
	[AgentQaEncryptedApiKey] [nvarchar](max) NULL,
	[TeamworkApiUrl] [nvarchar](500) NULL,
	[TeamworkEncryptedApiKey] [nvarchar](max) NULL,
	[AdBindDn] [nvarchar](500) NULL,
	[AdEncryptedBindPassword] [nvarchar](max) NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[OpsAuditLog]    Script Date: 11/4/2026 3:32:13 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[OpsAuditLog](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[EventType] [varchar](40) NOT NULL,
	[StaffName] [nvarchar](200) NULL,
	[ActorName] [nvarchar](100) NULL,
	[DeviceId] [varchar](36) NULL,
	[DeviceLabel] [nvarchar](200) NULL,
	[OS] [varchar](20) NULL,
	[TaskType] [nvarchar](80) NULL,
	[IncidentNumber] [varchar](20) NULL,
	[Detail] [nvarchar](1000) NULL,
	[StartedAt] [datetime2](7) NULL,
	[CompletedAt] [datetime2](7) NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[OuiVendors]    Script Date: 11/4/2026 3:32:13 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[OuiVendors](
	[Prefix] [varchar](6) NOT NULL,
	[VendorName] [nvarchar](300) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Prefix] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[PasswordChangeLogs]    Script Date: 11/4/2026 3:32:13 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[PasswordChangeLogs](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[AssetId] [int] NOT NULL,
	[AccountOrServiceName] [nvarchar](200) NOT NULL,
	[AccountType] [varchar](30) NOT NULL,
	[UsernameOrAccountId] [nvarchar](200) NULL,
	[CredentialLocationRef] [nvarchar](500) NULL,
	[LastPasswordChangeDate] [date] NULL,
	[RotationIntervalDays] [int] NULL,
	[NextPasswordChangeDate] [date] NULL,
	[Status] [varchar](20) NOT NULL,
	[ChangedBy] [nvarchar](200) NULL,
	[ApprovedBy] [nvarchar](200) NULL,
	[VerificationStatus] [varchar](20) NULL,
	[VerificationDate] [date] NULL,
	[ReasonForChange] [nvarchar](500) NULL,
	[ChangeRequestNumber] [nvarchar](100) NULL,
	[Notes] [nvarchar](max) NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[CreatedByUserId] [int] NULL,
	[CreatedByUsername] [nvarchar](100) NULL,
	[UpdatedAt] [datetime2](7) NOT NULL,
	[UpdatedByUserId] [int] NULL,
	[UpdatedByUsername] [nvarchar](100) NULL,
	[IsDeleted] [bit] NOT NULL,
	[DeletedAt] [datetime2](7) NULL,
	[DeletedByUserId] [int] NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[PatchUpdateLogs]    Script Date: 11/4/2026 3:32:13 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[PatchUpdateLogs](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[AssetId] [int] NOT NULL,
	[UpdateType] [varchar](30) NOT NULL,
	[Vendor] [nvarchar](200) NULL,
	[Product] [nvarchar](200) NULL,
	[PatchName] [nvarchar](300) NOT NULL,
	[KbOrPatchReference] [nvarchar](100) NULL,
	[Version] [nvarchar](100) NULL,
	[Severity] [varchar](20) NOT NULL,
	[ReleaseDate] [date] NULL,
	[ScheduledInstallationDate] [date] NULL,
	[ActualInstallationDate] [date] NULL,
	[InstallationStatus] [varchar](20) NOT NULL,
	[RebootRequired] [bit] NOT NULL,
	[RebootCompleted] [bit] NOT NULL,
	[ValidationStatus] [varchar](20) NOT NULL,
	[ValidationDate] [date] NULL,
	[InstalledBy] [nvarchar](200) NULL,
	[ApprovedBy] [nvarchar](200) NULL,
	[ChangeRequestNumber] [nvarchar](100) NULL,
	[FailureReason] [nvarchar](1000) NULL,
	[RollbackPerformed] [bit] NOT NULL,
	[RollbackDetails] [nvarchar](1000) NULL,
	[Notes] [nvarchar](max) NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[CreatedByUserId] [int] NULL,
	[CreatedByUsername] [nvarchar](100) NULL,
	[UpdatedAt] [datetime2](7) NOT NULL,
	[UpdatedByUserId] [int] NULL,
	[UpdatedByUsername] [nvarchar](100) NULL,
	[IsDeleted] [bit] NOT NULL,
	[DeletedAt] [datetime2](7) NULL,
	[DeletedByUserId] [int] NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[PendingEmailDigestQueue]    Script Date: 11/4/2026 3:32:13 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[PendingEmailDigestQueue](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[ToAddress] [nvarchar](320) NOT NULL,
	[Subject] [nvarchar](500) NOT NULL,
	[Body] [nvarchar](max) NOT NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[PendingMalwareScanRequests]    Script Date: 11/4/2026 3:32:13 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[PendingMalwareScanRequests](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[DeviceId] [varchar](36) NOT NULL,
	[RequestedByUserId] [int] NOT NULL,
	[RequestedAt] [datetime2](7) NOT NULL,
	[FulfilledAt] [datetime2](7) NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[PendingPhpLogRequests]    Script Date: 11/4/2026 3:32:13 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[PendingPhpLogRequests](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[DeviceId] [varchar](36) NOT NULL,
	[Version] [varchar](10) NOT NULL,
	[Sapi] [varchar](10) NOT NULL,
	[RequestedByUserId] [int] NOT NULL,
	[RequestedAt] [datetime2](7) NOT NULL,
	[FulfilledAt] [datetime2](7) NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[PendingPowerActionRequests]    Script Date: 11/4/2026 3:32:13 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[PendingPowerActionRequests](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[DeviceId] [varchar](36) NOT NULL,
	[ActionType] [varchar](10) NOT NULL,
	[RequestedByUserId] [int] NOT NULL,
	[RequestedAt] [datetime2](7) NOT NULL,
	[FulfilledAt] [datetime2](7) NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[PendingScreenshotRequests]    Script Date: 11/4/2026 3:32:13 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[PendingScreenshotRequests](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[DeviceId] [varchar](36) NOT NULL,
	[RequestedByUserId] [int] NOT NULL,
	[RequestedAt] [datetime2](7) NOT NULL,
	[FulfilledAt] [datetime2](7) NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[PendingUpdateRequests]    Script Date: 11/4/2026 3:32:13 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[PendingUpdateRequests](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[DeviceId] [varchar](36) NOT NULL,
	[Kind] [varchar](20) NOT NULL,
	[PayloadJson] [nvarchar](max) NULL,
	[AllowDisruptive] [bit] NOT NULL,
	[RequestedByUserId] [int] NULL,
	[RequestedByName] [nvarchar](100) NULL,
	[ConfirmedByUserId] [int] NULL,
	[ScheduledFor] [datetime2](7) NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[ExpiresAt] [datetime2](7) NOT NULL,
	[FulfilledAt] [datetime2](7) NULL,
	[ResultStatus] [varchar](20) NULL,
	[StartedAt] [datetime2](7) NULL,
	[ResultSummary] [nvarchar](1000) NULL,
	[RebootRequired] [bit] NULL,
	[ConfirmedByName] [nvarchar](100) NULL,
	[ScheduleId] [int] NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[PendingWakeRequests]    Script Date: 11/4/2026 3:32:13 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[PendingWakeRequests](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[RelayDeviceId] [varchar](100) NULL,
	[TargetDeviceId] [varchar](100) NOT NULL,
	[TargetMac] [varchar](17) NOT NULL,
	[RequestedByUserId] [int] NULL,
	[RequestedAt] [datetime2](7) NOT NULL,
	[ExpiresAt] [datetime2](7) NOT NULL,
	[FulfilledAt] [datetime2](7) NULL,
	[TargetSubnetPrefix] [varchar](16) NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[PhpLogContent]    Script Date: 11/4/2026 3:32:13 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[PhpLogContent](
	[DeviceId] [varchar](36) NOT NULL,
	[Version] [varchar](10) NOT NULL,
	[Sapi] [varchar](10) NOT NULL,
	[Content] [nvarchar](max) NULL,
	[ErrorMessage] [nvarchar](500) NULL,
	[FetchedAt] [datetime2](7) NOT NULL,
 CONSTRAINT [PK_PhpLogContent] PRIMARY KEY CLUSTERED 
(
	[DeviceId] ASC,
	[Version] ASC,
	[Sapi] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[PhpVersions]    Script Date: 11/4/2026 3:32:13 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[PhpVersions](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[DeviceId] [varchar](36) NOT NULL,
	[Version] [varchar](10) NOT NULL,
	[SapiCli] [bit] NOT NULL,
	[SapiFpm] [bit] NOT NULL,
	[CliErrorLogPath] [nvarchar](500) NULL,
	[FpmErrorLogPath] [nvarchar](500) NULL,
	[IsDefault] [bit] NOT NULL,
	[UpdatedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[QaActivityLogs]    Script Date: 11/4/2026 3:32:13 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[QaActivityLogs](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[EntityType] [varchar](30) NOT NULL,
	[EntityId] [int] NOT NULL,
	[Action] [varchar](50) NOT NULL,
	[PreviousValue] [nvarchar](max) NULL,
	[NewValue] [nvarchar](max) NULL,
	[UserId] [int] NULL,
	[IpAddress] [varchar](64) NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[QaAttachments]    Script Date: 11/4/2026 3:32:13 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[QaAttachments](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[EntityType] [varchar](30) NOT NULL,
	[EntityId] [int] NOT NULL,
	[FilePath] [nvarchar](500) NOT NULL,
	[OriginalFileName] [nvarchar](300) NOT NULL,
	[ContentType] [nvarchar](100) NULL,
	[SizeBytes] [int] NOT NULL,
	[UploadedByUserId] [int] NULL,
	[UploadedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[QaBugs]    Script Date: 11/4/2026 3:32:13 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[QaBugs](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[BugNumber] [varchar](20) NOT NULL,
	[Title] [nvarchar](300) NOT NULL,
	[Description] [nvarchar](max) NULL,
	[ProjectId] [int] NOT NULL,
	[TestCaseId] [int] NULL,
	[TestExecutionId] [int] NULL,
	[TestRunId] [int] NULL,
	[StepsToReproduce] [nvarchar](max) NULL,
	[ExpectedResult] [nvarchar](max) NULL,
	[ActualResult] [nvarchar](max) NULL,
	[Severity] [varchar](20) NOT NULL,
	[Priority] [varchar](20) NOT NULL,
	[Status] [varchar](20) NOT NULL,
	[AssignedDeveloperUserId] [int] NULL,
	[ReporterUserId] [int] NULL,
	[Environment] [nvarchar](100) NULL,
	[Browser] [nvarchar](100) NULL,
	[Device] [nvarchar](100) NULL,
	[AppVersion] [nvarchar](50) NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[UpdatedAt] [datetime2](7) NOT NULL,
	[ResolvedAt] [datetime2](7) NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY],
UNIQUE NONCLUSTERED 
(
	[BugNumber] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[QaBuilds]    Script Date: 11/4/2026 3:32:13 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[QaBuilds](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[ProjectId] [int] NOT NULL,
	[ReleaseId] [int] NULL,
	[BuildNumber] [nvarchar](100) NOT NULL,
	[GitCommit] [nvarchar](100) NULL,
	[Branch] [nvarchar](100) NULL,
	[DeploymentDate] [datetime2](7) NULL,
	[EnvironmentId] [int] NULL,
	[Status] [varchar](20) NOT NULL,
	[CreatedByUserId] [int] NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[QaComments]    Script Date: 11/4/2026 3:32:13 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[QaComments](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[EntityType] [varchar](30) NOT NULL,
	[EntityId] [int] NOT NULL,
	[AuthorUserId] [int] NULL,
	[Message] [nvarchar](max) NOT NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[QaEnvironments]    Script Date: 11/4/2026 3:32:13 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[QaEnvironments](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[ProjectId] [int] NOT NULL,
	[Name] [nvarchar](100) NOT NULL,
	[ApiUrl] [nvarchar](300) NULL,
	[DatabaseInfo] [nvarchar](300) NULL,
	[BuildVersion] [nvarchar](100) NULL,
	[ConfigNotes] [nvarchar](1000) NULL,
	[IsActive] [bit] NOT NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[UpdatedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[QaMilestones]    Script Date: 11/4/2026 3:32:13 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[QaMilestones](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[ProjectId] [int] NOT NULL,
	[ReleaseId] [int] NULL,
	[Name] [nvarchar](200) NOT NULL,
	[MilestoneType] [varchar](20) NOT NULL,
	[DueDate] [date] NULL,
	[Status] [varchar](20) NOT NULL,
	[Description] [nvarchar](1000) NULL,
	[CreatedByUserId] [int] NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[UpdatedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[QaMilestoneTestPlans]    Script Date: 11/4/2026 3:32:13 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[QaMilestoneTestPlans](
	[MilestoneId] [int] NOT NULL,
	[TestPlanId] [int] NOT NULL,
 CONSTRAINT [PK_QaMilestoneTestPlans] PRIMARY KEY CLUSTERED 
(
	[MilestoneId] ASC,
	[TestPlanId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[QaModules]    Script Date: 11/4/2026 3:32:13 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[QaModules](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[ProjectId] [int] NOT NULL,
	[Name] [nvarchar](200) NOT NULL,
	[Description] [nvarchar](1000) NULL,
	[CreatedByUserId] [int] NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[UpdatedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[QaProjects]    Script Date: 11/4/2026 3:32:13 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[QaProjects](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[Name] [nvarchar](200) NOT NULL,
	[Description] [nvarchar](1000) NULL,
	[IsActive] [bit] NOT NULL,
	[CreatedByUserId] [int] NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[UpdatedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[QaReleases]    Script Date: 11/4/2026 3:32:13 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[QaReleases](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[ProjectId] [int] NOT NULL,
	[Name] [nvarchar](100) NOT NULL,
	[ReleaseDate] [date] NULL,
	[Status] [varchar](20) NOT NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[ReleasedByUserId] [int] NULL,
	[ReleasedAt] [datetime2](7) NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[QaRequirements]    Script Date: 11/4/2026 3:32:13 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[QaRequirements](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[RequirementNumber] [varchar](20) NOT NULL,
	[ProjectId] [int] NOT NULL,
	[Title] [nvarchar](300) NOT NULL,
	[Description] [nvarchar](max) NULL,
	[Category] [nvarchar](50) NULL,
	[Priority] [varchar](20) NOT NULL,
	[Status] [varchar](20) NOT NULL,
	[CreatedByUserId] [int] NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[UpdatedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY],
UNIQUE NONCLUSTERED 
(
	[RequirementNumber] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[QaRequirementTestCases]    Script Date: 11/4/2026 3:32:13 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[QaRequirementTestCases](
	[RequirementId] [int] NOT NULL,
	[TestCaseId] [int] NOT NULL,
 CONSTRAINT [PK_QaRequirementTestCases] PRIMARY KEY CLUSTERED 
(
	[RequirementId] ASC,
	[TestCaseId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[QaTestCaseRunTypes]    Script Date: 11/4/2026 3:32:13 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[QaTestCaseRunTypes](
	[TestCaseId] [int] NOT NULL,
	[RunTypeId] [int] NOT NULL,
 CONSTRAINT [PK_QaTestCaseRunTypes] PRIMARY KEY CLUSTERED 
(
	[TestCaseId] ASC,
	[RunTypeId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[QaTestCases]    Script Date: 11/4/2026 3:32:13 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[QaTestCases](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[ProjectId] [int] NOT NULL,
	[ModuleId] [int] NULL,
	[TestSuiteId] [int] NOT NULL,
	[TestCaseNumber] [varchar](20) NOT NULL,
	[Title] [nvarchar](300) NOT NULL,
	[Description] [nvarchar](max) NULL,
	[Preconditions] [nvarchar](max) NULL,
	[ExpectedResult] [nvarchar](max) NULL,
	[Priority] [varchar](20) NOT NULL,
	[Severity] [varchar](20) NULL,
	[TestType] [varchar](30) NOT NULL,
	[AutomationStatus] [varchar](20) NOT NULL,
	[EstimatedMinutes] [int] NULL,
	[Status] [varchar](20) NOT NULL,
	[CreatedByUserId] [int] NULL,
	[UpdatedByUserId] [int] NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[UpdatedAt] [datetime2](7) NOT NULL,
	[ReviewedByUserId] [int] NULL,
	[ReviewedAt] [datetime2](7) NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY],
UNIQUE NONCLUSTERED 
(
	[TestCaseNumber] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[QaTestCaseSteps]    Script Date: 11/4/2026 3:32:13 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[QaTestCaseSteps](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[TestCaseId] [int] NOT NULL,
	[StepNumber] [int] NOT NULL,
	[Action] [nvarchar](max) NOT NULL,
	[TestData] [nvarchar](max) NULL,
	[ExpectedResult] [nvarchar](max) NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[QaTestCaseTags]    Script Date: 11/4/2026 3:32:13 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[QaTestCaseTags](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[TestCaseId] [int] NOT NULL,
	[Tag] [nvarchar](50) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[QaTestExecutions]    Script Date: 11/4/2026 3:32:13 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[QaTestExecutions](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[TestRunCaseId] [int] NOT NULL,
	[Result] [varchar](20) NOT NULL,
	[ActualResult] [nvarchar](max) NULL,
	[Notes] [nvarchar](max) NULL,
	[DurationMinutes] [int] NULL,
	[Browser] [nvarchar](100) NULL,
	[Device] [nvarchar](100) NULL,
	[OperatingSystem] [nvarchar](100) NULL,
	[AppVersion] [nvarchar](50) NULL,
	[ExecutedByUserId] [int] NULL,
	[ExecutedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[QaTestPlanRuns]    Script Date: 11/4/2026 3:32:13 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[QaTestPlanRuns](
	[TestPlanId] [int] NOT NULL,
	[TestRunId] [int] NOT NULL,
 CONSTRAINT [PK_QaTestPlanRuns] PRIMARY KEY CLUSTERED 
(
	[TestPlanId] ASC,
	[TestRunId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[QaTestPlans]    Script Date: 11/4/2026 3:32:13 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[QaTestPlans](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[TestPlanNumber] [varchar](20) NOT NULL,
	[ProjectId] [int] NOT NULL,
	[ReleaseId] [int] NULL,
	[Name] [nvarchar](200) NOT NULL,
	[Description] [nvarchar](1000) NULL,
	[Status] [varchar](20) NOT NULL,
	[CreatedByUserId] [int] NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[UpdatedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY],
UNIQUE NONCLUSTERED 
(
	[TestPlanNumber] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[QaTestRunCases]    Script Date: 11/4/2026 3:32:13 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[QaTestRunCases](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[TestRunId] [int] NOT NULL,
	[TestCaseId] [int] NOT NULL,
	[AssignedUserId] [int] NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY],
 CONSTRAINT [UQ_QaTestRunCases_Run_Case] UNIQUE NONCLUSTERED 
(
	[TestRunId] ASC,
	[TestCaseId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[QaTestRuns]    Script Date: 11/4/2026 3:32:14 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[QaTestRuns](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[TestRunNumber] [varchar](20) NOT NULL,
	[Name] [nvarchar](200) NOT NULL,
	[Description] [nvarchar](1000) NULL,
	[ProjectId] [int] NOT NULL,
	[ReleaseId] [int] NULL,
	[Environment] [nvarchar](100) NULL,
	[Browser] [nvarchar](100) NULL,
	[OperatingSystem] [nvarchar](100) NULL,
	[Device] [nvarchar](100) NULL,
	[StartDate] [date] NULL,
	[EndDate] [date] NULL,
	[Status] [varchar](20) NOT NULL,
	[CreatedByUserId] [int] NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[UpdatedAt] [datetime2](7) NOT NULL,
	[RunType] [varchar](20) NOT NULL,
	[DeployedBuildVersion] [nvarchar](50) NULL,
	[DeployedAt] [datetime2](7) NULL,
	[QaApprovedByUserId] [int] NULL,
	[QaApprovedAt] [datetime2](7) NULL,
	[RunTypeId] [int] NULL,
	[EnvironmentId] [int] NULL,
	[BuildId] [int] NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY],
UNIQUE NONCLUSTERED 
(
	[TestRunNumber] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[QaTestRunTypes]    Script Date: 11/4/2026 3:32:14 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[QaTestRunTypes](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[Name] [nvarchar](100) NOT NULL,
	[Description] [nvarchar](500) NULL,
	[IsActive] [bit] NOT NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[UpdatedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY],
UNIQUE NONCLUSTERED 
(
	[Name] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[QaTestSuites]    Script Date: 11/4/2026 3:32:14 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[QaTestSuites](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[ProjectId] [int] NOT NULL,
	[ModuleId] [int] NULL,
	[Name] [nvarchar](200) NOT NULL,
	[Description] [nvarchar](1000) NULL,
	[Status] [varchar](20) NOT NULL,
	[CreatedByUserId] [int] NULL,
	[UpdatedByUserId] [int] NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[UpdatedAt] [datetime2](7) NOT NULL,
	[RequirementRef] [nvarchar](200) NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[RemoteAccessSettings]    Script Date: 11/4/2026 3:32:14 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[RemoteAccessSettings](
	[Id] [int] NOT NULL,
	[VaultSaltHex] [varchar](64) NOT NULL,
	[VaultLockAfterMinutes] [int] NOT NULL,
	[DefaultConnectionTimeoutSeconds] [int] NOT NULL,
	[DefaultKeepaliveIntervalSeconds] [int] NOT NULL,
	[ConnectionCheckIntervalMinutes] [int] NOT NULL,
	[UpdatedAt] [datetime2](7) NOT NULL,
	[UpdatedByUserId] [int] NULL,
	[NotifyOnConnectionOfflineContactIds] [nvarchar](500) NULL,
	[RequireApprovalForBulkExecution] [bit] NOT NULL,
	[BulkExecutionApprovalThreshold] [int] NOT NULL,
	[SessionIdleTimeoutMinutes] [int] NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[RemoteApprovalRequests]    Script Date: 11/4/2026 3:32:14 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[RemoteApprovalRequests](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[ActionType] [varchar](50) NOT NULL,
	[Payload] [nvarchar](max) NOT NULL,
	[Summary] [nvarchar](500) NOT NULL,
	[RequestedByUserId] [int] NOT NULL,
	[RequestedByUsername] [nvarchar](100) NOT NULL,
	[Status] [varchar](20) NOT NULL,
	[ReviewedByUserId] [int] NULL,
	[ReviewedByUsername] [nvarchar](100) NULL,
	[ReviewNote] [nvarchar](500) NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[ReviewedAt] [datetime2](7) NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[RemoteAuditLog]    Script Date: 11/4/2026 3:32:14 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[RemoteAuditLog](
	[Id] [bigint] IDENTITY(1,1) NOT NULL,
	[EventType] [varchar](40) NOT NULL,
	[UserId] [int] NULL,
	[Username] [nvarchar](100) NULL,
	[Protocol] [varchar](20) NULL,
	[ConnectionId] [int] NULL,
	[Host] [nvarchar](255) NULL,
	[SourceIp] [varchar](45) NULL,
	[SessionId] [int] NULL,
	[Action] [nvarchar](200) NULL,
	[Result] [varchar](20) NOT NULL,
	[FailureReason] [nvarchar](500) NULL,
	[DurationMs] [int] NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[RemoteCertificates]    Script Date: 11/4/2026 3:32:14 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[RemoteCertificates](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[ConnectionId] [int] NULL,
	[Host] [nvarchar](255) NOT NULL,
	[Port] [int] NOT NULL,
	[Fingerprint] [varchar](200) NOT NULL,
	[Subject] [nvarchar](500) NULL,
	[Issuer] [nvarchar](500) NULL,
	[ValidFrom] [datetime2](7) NULL,
	[ValidTo] [datetime2](7) NULL,
	[IsTrusted] [bit] NOT NULL,
	[TrustedAt] [datetime2](7) NULL,
	[TrustedByUserId] [int] NULL,
	[FirstSeenAt] [datetime2](7) NOT NULL,
	[LastSeenAt] [datetime2](7) NOT NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[CreatedByUserId] [int] NULL,
	[UpdatedAt] [datetime2](7) NOT NULL,
	[UpdatedByUserId] [int] NULL,
	[IsActive] [bit] NOT NULL,
	[IsDeleted] [bit] NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[RemoteConnectionChecks]    Script Date: 11/4/2026 3:32:14 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[RemoteConnectionChecks](
	[Id] [bigint] IDENTITY(1,1) NOT NULL,
	[ConnectionId] [int] NOT NULL,
	[CheckedAt] [datetime2](7) NOT NULL,
	[Status] [varchar](20) NOT NULL,
	[LatencyMs] [int] NULL,
	[ErrorMessage] [nvarchar](500) NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[RemoteConnectionGroups]    Script Date: 11/4/2026 3:32:14 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[RemoteConnectionGroups](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[Name] [nvarchar](200) NOT NULL,
	[ParentGroupId] [int] NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[CreatedByUserId] [int] NULL,
	[UpdatedAt] [datetime2](7) NOT NULL,
	[UpdatedByUserId] [int] NULL,
	[IsActive] [bit] NOT NULL,
	[IsDeleted] [bit] NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[RemoteConnections]    Script Date: 11/4/2026 3:32:14 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[RemoteConnections](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[Name] [nvarchar](200) NOT NULL,
	[Hostname] [nvarchar](255) NULL,
	[IpAddress] [varchar](45) NULL,
	[Port] [int] NOT NULL,
	[Protocol] [varchar](20) NOT NULL,
	[Username] [nvarchar](200) NULL,
	[Domain] [nvarchar](200) NULL,
	[CredentialId] [int] NULL,
	[SshKeyId] [int] NULL,
	[RemoteDirectory] [nvarchar](1000) NULL,
	[OperatingSystem] [varchar](30) NULL,
	[DeviceType] [varchar](30) NULL,
	[Environment] [varchar](30) NOT NULL,
	[Customer] [nvarchar](200) NULL,
	[Location] [nvarchar](200) NULL,
	[GroupId] [int] NULL,
	[Tags] [nvarchar](500) NULL,
	[Notes] [nvarchar](1000) NULL,
	[IsFavorite] [bit] NOT NULL,
	[ConnectionTimeoutSeconds] [int] NOT NULL,
	[KeepaliveIntervalSeconds] [int] NOT NULL,
	[AutoReconnect] [bit] NOT NULL,
	[JumpHostConnectionId] [int] NULL,
	[ProxyConfigJson] [nvarchar](max) NULL,
	[RdpGatewayConfigJson] [nvarchar](max) NULL,
	[VpnDependencyNote] [nvarchar](500) NULL,
	[PreConnectCommand] [nvarchar](1000) NULL,
	[PostConnectCommand] [nvarchar](1000) NULL,
	[LastSuccessAt] [datetime2](7) NULL,
	[LastFailureAt] [datetime2](7) NULL,
	[AvailabilityStatus] [varchar](20) NOT NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[CreatedByUserId] [int] NULL,
	[UpdatedAt] [datetime2](7) NOT NULL,
	[UpdatedByUserId] [int] NULL,
	[IsActive] [bit] NOT NULL,
	[IsDeleted] [bit] NOT NULL,
	[IsShared] [bit] NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[RemoteCredentials]    Script Date: 11/4/2026 3:32:14 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[RemoteCredentials](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[Name] [nvarchar](200) NOT NULL,
	[CredentialType] [varchar](30) NOT NULL,
	[EncryptedSecret] [nvarchar](max) NOT NULL,
	[Username] [nvarchar](200) NULL,
	[Domain] [nvarchar](200) NULL,
	[ExpiresAt] [datetime2](7) NULL,
	[LastRotatedAt] [datetime2](7) NULL,
	[RotationReminderDays] [int] NULL,
	[LastAccessedAt] [datetime2](7) NULL,
	[LastAccessedByUserId] [int] NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[CreatedByUserId] [int] NULL,
	[UpdatedAt] [datetime2](7) NOT NULL,
	[UpdatedByUserId] [int] NULL,
	[IsActive] [bit] NOT NULL,
	[IsDeleted] [bit] NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[RemoteFileTransfers]    Script Date: 11/4/2026 3:32:14 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[RemoteFileTransfers](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[SessionId] [int] NULL,
	[ConnectionId] [int] NOT NULL,
	[Direction] [varchar](10) NOT NULL,
	[LocalPath] [nvarchar](2000) NULL,
	[RemotePath] [nvarchar](2000) NOT NULL,
	[SizeBytes] [bigint] NULL,
	[Status] [varchar](20) NOT NULL,
	[Checksum] [varchar](128) NULL,
	[ErrorMessage] [nvarchar](500) NULL,
	[StartedByUserId] [int] NOT NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[CreatedByUserId] [int] NULL,
	[UpdatedAt] [datetime2](7) NOT NULL,
	[UpdatedByUserId] [int] NULL,
	[IsActive] [bit] NOT NULL,
	[IsDeleted] [bit] NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[RemoteInventoryDevices]    Script Date: 11/4/2026 3:32:14 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[RemoteInventoryDevices](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[LinkedDeviceId] [varchar](36) NULL,
	[LinkedConnectionId] [int] NULL,
	[DeviceName] [nvarchar](200) NOT NULL,
	[Hostname] [nvarchar](255) NULL,
	[IpAddress] [varchar](45) NULL,
	[MacAddress] [varchar](20) NULL,
	[OperatingSystem] [varchar](30) NULL,
	[OsVersion] [nvarchar](100) NULL,
	[DeviceTypeCategory] [varchar](30) NULL,
	[Cpu] [nvarchar](200) NULL,
	[Memory] [nvarchar](100) NULL,
	[Disk] [nvarchar](100) NULL,
	[Environment] [varchar](30) NULL,
	[Customer] [nvarchar](200) NULL,
	[Owner] [nvarchar](200) NULL,
	[Location] [nvarchar](200) NULL,
	[AssetNumber] [nvarchar](100) NULL,
	[SerialNumber] [nvarchar](100) NULL,
	[AvailableProtocolsJson] [nvarchar](500) NULL,
	[OpenManagementPortsJson] [nvarchar](500) NULL,
	[MonitoringStatus] [varchar](20) NULL,
	[AvailabilityStatus] [varchar](20) NOT NULL,
	[LastConnectionAt] [datetime2](7) NULL,
	[Tags] [nvarchar](500) NULL,
	[Notes] [nvarchar](1000) NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[CreatedByUserId] [int] NULL,
	[UpdatedAt] [datetime2](7) NOT NULL,
	[UpdatedByUserId] [int] NULL,
	[IsActive] [bit] NOT NULL,
	[IsDeleted] [bit] NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[RemotePortForwards]    Script Date: 11/4/2026 3:32:14 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[RemotePortForwards](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[ConnectionId] [int] NOT NULL,
	[ForwardType] [varchar](10) NOT NULL,
	[LocalPort] [int] NOT NULL,
	[RemoteHost] [nvarchar](255) NULL,
	[RemotePort] [int] NULL,
	[Status] [varchar](20) NOT NULL,
	[StartedByUserId] [int] NULL,
	[StartedAt] [datetime2](7) NULL,
	[StoppedAt] [datetime2](7) NULL,
	[ErrorMessage] [nvarchar](500) NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[CreatedByUserId] [int] NULL,
	[UpdatedAt] [datetime2](7) NOT NULL,
	[UpdatedByUserId] [int] NULL,
	[IsActive] [bit] NOT NULL,
	[IsDeleted] [bit] NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[RemoteProtocolDiagnostics]    Script Date: 11/4/2026 3:32:14 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[RemoteProtocolDiagnostics](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[ConnectionId] [int] NULL,
	[Protocol] [varchar](20) NOT NULL,
	[Host] [nvarchar](255) NOT NULL,
	[Port] [int] NULL,
	[Status] [varchar](20) NOT NULL,
	[Method] [varchar](100) NULL,
	[Message] [nvarchar](500) NULL,
	[RanByUserId] [int] NULL,
	[RanAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[RemoteScriptExecutions]    Script Date: 11/4/2026 3:32:14 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[RemoteScriptExecutions](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[ScriptId] [int] NOT NULL,
	[ConnectionId] [int] NOT NULL,
	[BatchId] [uniqueidentifier] NULL,
	[ExecutedByUserId] [int] NOT NULL,
	[StartedAt] [datetime2](7) NOT NULL,
	[EndedAt] [datetime2](7) NULL,
	[Status] [varchar](20) NOT NULL,
	[ExitCode] [int] NULL,
	[Output] [nvarchar](max) NULL,
	[ErrorMessage] [nvarchar](500) NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[CreatedByUserId] [int] NULL,
	[UpdatedAt] [datetime2](7) NOT NULL,
	[UpdatedByUserId] [int] NULL,
	[IsActive] [bit] NOT NULL,
	[IsDeleted] [bit] NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[RemoteScripts]    Script Date: 11/4/2026 3:32:14 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[RemoteScripts](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[Name] [nvarchar](200) NOT NULL,
	[Description] [nvarchar](1000) NULL,
	[ScriptType] [varchar](20) NOT NULL,
	[Body] [nvarchar](max) NOT NULL,
	[TargetOsFamily] [varchar](20) NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[CreatedByUserId] [int] NULL,
	[UpdatedAt] [datetime2](7) NOT NULL,
	[UpdatedByUserId] [int] NULL,
	[IsActive] [bit] NOT NULL,
	[IsDeleted] [bit] NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[RemoteSessionEvents]    Script Date: 11/4/2026 3:32:14 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[RemoteSessionEvents](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[SessionId] [int] NOT NULL,
	[EventType] [varchar](40) NOT NULL,
	[DetailsJson] [nvarchar](max) NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[RemoteSessionFileTransfers]    Script Date: 11/4/2026 3:32:14 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[RemoteSessionFileTransfers](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[SessionId] [int] NOT NULL,
	[Direction] [varchar](20) NOT NULL,
	[FileName] [nvarchar](260) NOT NULL,
	[SizeBytes] [bigint] NOT NULL,
	[ApprovedByEmployeeAt] [datetime2](7) NULL,
	[Status] [varchar](20) NOT NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[CompletedAt] [datetime2](7) NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[RemoteSessionLogs]    Script Date: 11/4/2026 3:32:14 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[RemoteSessionLogs](
	[Id] [bigint] IDENTITY(1,1) NOT NULL,
	[SessionId] [int] NOT NULL,
	[Sequence] [bigint] NOT NULL,
	[Direction] [varchar](10) NOT NULL,
	[Content] [nvarchar](max) NOT NULL,
	[LoggedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[RemoteSessions]    Script Date: 11/4/2026 3:32:14 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[RemoteSessions](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[ConnectionId] [int] NULL,
	[SessionType] [varchar](20) NOT NULL,
	[Protocol] [varchar](20) NOT NULL,
	[TargetHost] [nvarchar](255) NOT NULL,
	[TargetPort] [int] NOT NULL,
	[IsAdHoc] [bit] NOT NULL,
	[StartedByUserId] [int] NOT NULL,
	[StartedByUsername] [nvarchar](100) NULL,
	[StartedAt] [datetime2](7) NOT NULL,
	[EndedAt] [datetime2](7) NULL,
	[Status] [varchar](20) NOT NULL,
	[RecordingStatus] [varchar](20) NOT NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[CreatedByUserId] [int] NULL,
	[UpdatedAt] [datetime2](7) NOT NULL,
	[UpdatedByUserId] [int] NULL,
	[IsActive] [bit] NOT NULL,
	[IsDeleted] [bit] NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[RemoteSessionSignaling]    Script Date: 11/4/2026 3:32:14 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[RemoteSessionSignaling](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[SessionId] [int] NOT NULL,
	[Direction] [varchar](20) NOT NULL,
	[MessageType] [varchar](20) NOT NULL,
	[Payload] [nvarchar](max) NOT NULL,
	[ConsumedAt] [datetime2](7) NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[RemoteSSHKeys]    Script Date: 11/4/2026 3:32:14 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[RemoteSSHKeys](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[Name] [nvarchar](200) NOT NULL,
	[KeyType] [varchar](20) NOT NULL,
	[PublicKey] [nvarchar](max) NOT NULL,
	[EncryptedPrivateKey] [nvarchar](max) NOT NULL,
	[Fingerprint] [varchar](200) NOT NULL,
	[PassphraseCredentialId] [int] NULL,
	[ExpiresAt] [datetime2](7) NULL,
	[LastAccessedAt] [datetime2](7) NULL,
	[LastAccessedByUserId] [int] NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[CreatedByUserId] [int] NULL,
	[UpdatedAt] [datetime2](7) NOT NULL,
	[UpdatedByUserId] [int] NULL,
	[IsActive] [bit] NOT NULL,
	[IsDeleted] [bit] NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[RemoteSupportSessions]    Script Date: 11/4/2026 3:32:14 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[RemoteSupportSessions](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[SessionGuid] [uniqueidentifier] NOT NULL,
	[DeviceId] [varchar](36) NOT NULL,
	[RequestedByUserId] [int] NOT NULL,
	[Reason] [nvarchar](500) NOT NULL,
	[Status] [varchar](20) NOT NULL,
	[ApprovalNonce] [varchar](64) NOT NULL,
	[RequestedAt] [datetime2](7) NOT NULL,
	[ExpiresAt] [datetime2](7) NOT NULL,
	[RespondedAt] [datetime2](7) NULL,
	[Approved] [bit] NULL,
	[StartedAt] [datetime2](7) NULL,
	[EndedAt] [datetime2](7) NULL,
	[TerminationReason] [varchar](30) NULL,
	[PermissionsGranted] [varchar](100) NOT NULL,
	[SourceIp] [varchar](45) NOT NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[RepoConnections]    Script Date: 11/4/2026 3:32:14 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[RepoConnections](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[Provider] [varchar](20) NOT NULL,
	[Name] [nvarchar](200) NOT NULL,
	[AuthMethod] [varchar](20) NOT NULL,
	[InstanceUrl] [nvarchar](500) NULL,
	[OwnerLogin] [nvarchar](200) NULL,
	[AccessTokenEncrypted] [nvarchar](max) NULL,
	[RefreshTokenEncrypted] [nvarchar](max) NULL,
	[TokenExpiresAt] [datetime2](7) NULL,
	[InstallationId] [bigint] NULL,
	[ScopesGranted] [nvarchar](500) NULL,
	[CreatedByUserId] [int] NOT NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[UpdatedAt] [datetime2](7) NOT NULL,
	[DeletedAt] [datetime2](7) NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[RoleMenuAccess]    Script Date: 11/4/2026 3:32:14 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[RoleMenuAccess](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[RoleId] [int] NOT NULL,
	[MenuKey] [nvarchar](150) NOT NULL,
	[Allowed] [bit] NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY],
 CONSTRAINT [UQ_RoleMenuAccess] UNIQUE NONCLUSTERED 
(
	[RoleId] ASC,
	[MenuKey] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[RolePermissions]    Script Date: 11/4/2026 3:32:14 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[RolePermissions](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[RoleId] [int] NOT NULL,
	[PermissionKey] [nvarchar](100) NOT NULL,
	[Allowed] [bit] NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Roles]    Script Date: 11/4/2026 3:32:14 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Roles](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[Name] [nvarchar](100) NOT NULL,
	[Description] [nvarchar](300) NULL,
	[IsSystem] [bit] NOT NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[UpdatedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY],
UNIQUE NONCLUSTERED 
(
	[Name] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[RouterActiveUsers]    Script Date: 11/4/2026 3:32:14 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[RouterActiveUsers](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[Name] [nvarchar](100) NOT NULL,
	[Address] [varchar](45) NULL,
	[Via] [nvarchar](20) NULL,
	[LoginTime] [datetime2](7) NULL,
	[ReceivedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[RouterBandwidth]    Script Date: 11/4/2026 3:32:14 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[RouterBandwidth](
	[Id] [bigint] IDENTITY(1,1) NOT NULL,
	[ReceivedAt] [datetime2](7) NOT NULL,
	[Interface] [nvarchar](50) NOT NULL,
	[RxMbps] [decimal](10, 3) NULL,
	[TxMbps] [decimal](10, 3) NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[RouterClients]    Script Date: 11/4/2026 3:32:14 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[RouterClients](
	[IpAddress] [varchar](45) NOT NULL,
	[MacAddress] [varchar](20) NULL,
	[Hostname] [nvarchar](200) NULL,
	[Status] [nvarchar](30) NULL,
	[LastSeenRaw] [nvarchar](30) NULL,
	[ExpiresAfterRaw] [nvarchar](30) NULL,
	[FirstSeenAt] [datetime2](7) NOT NULL,
	[UpdatedAt] [datetime2](7) NOT NULL,
	[Os] [nvarchar](50) NULL,
	[FirstSeen] [datetime2](7) NULL,
PRIMARY KEY CLUSTERED 
(
	[IpAddress] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[RouterClientTraffic]    Script Date: 11/4/2026 3:32:14 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[RouterClientTraffic](
	[Id] [bigint] IDENTITY(1,1) NOT NULL,
	[ReceivedAt] [datetime2](7) NOT NULL,
	[SrcAddress] [varchar](45) NOT NULL,
	[DstAddress] [varchar](45) NOT NULL,
	[Packets] [bigint] NOT NULL,
	[Bytes] [bigint] NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[RouterHealth]    Script Date: 11/4/2026 3:32:14 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[RouterHealth](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[ReceivedAt] [datetime2](7) NOT NULL,
	[UptimeSeconds] [bigint] NULL,
	[Version] [nvarchar](50) NULL,
	[BoardName] [nvarchar](100) NULL,
	[CpuLoadPct] [float] NULL,
	[CpuCount] [int] NULL,
	[CpuFrequencyMhz] [float] NULL,
	[FreeMemoryMB] [float] NULL,
	[TotalMemoryMB] [float] NULL,
	[FreeDiskMB] [float] NULL,
	[TotalDiskMB] [float] NULL,
	[Temperature] [float] NULL,
	[Voltage] [float] NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[RouterInterfaces]    Script Date: 11/4/2026 3:32:14 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[RouterInterfaces](
	[Name] [nvarchar](100) NOT NULL,
	[DefaultName] [nvarchar](100) NULL,
	[Type] [nvarchar](50) NULL,
	[Running] [bit] NOT NULL,
	[Disabled] [bit] NOT NULL,
	[Slave] [bit] NOT NULL,
	[Mtu] [nvarchar](20) NULL,
	[MacAddress] [varchar](20) NULL,
	[Comment] [nvarchar](200) NULL,
	[LastLinkUpTime] [datetime2](7) NULL,
	[LastLinkDownTime] [datetime2](7) NULL,
	[LinkDowns] [int] NULL,
	[UpdatedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Name] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[RouterWebLogs]    Script Date: 11/4/2026 3:32:14 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[RouterWebLogs](
	[Id] [bigint] IDENTITY(1,1) NOT NULL,
	[ReceivedAt] [datetime2](7) NOT NULL,
	[DeviceTimestamp] [datetime2](7) NULL,
	[SrcIp] [varchar](45) NULL,
	[SrcPort] [int] NULL,
	[SrcMac] [varchar](20) NULL,
	[DstIp] [varchar](45) NULL,
	[DstPort] [int] NULL,
	[Protocol] [varchar](20) NULL,
	[ReverseDns] [nvarchar](255) NULL,
	[RawMessage] [nvarchar](max) NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[ScheduledReportContacts]    Script Date: 11/4/2026 3:32:14 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[ScheduledReportContacts](
	[ScheduledReportId] [int] NOT NULL,
	[AlertContactId] [int] NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[ScheduledReportId] ASC,
	[AlertContactId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[ScheduledReportMonitors]    Script Date: 11/4/2026 3:32:14 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[ScheduledReportMonitors](
	[ScheduledReportId] [int] NOT NULL,
	[MonitorId] [int] NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[ScheduledReportId] ASC,
	[MonitorId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[ScheduledReports]    Script Date: 11/4/2026 3:32:14 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[ScheduledReports](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[Name] [nvarchar](200) NOT NULL,
	[Frequency] [varchar](10) NOT NULL,
	[Format] [varchar](10) NOT NULL,
	[MonitorScope] [varchar](10) NOT NULL,
	[RecipientEmails] [nvarchar](2000) NULL,
	[IsActive] [bit] NOT NULL,
	[LastSentAt] [datetime2](7) NULL,
	[NextSendAt] [datetime2](7) NOT NULL,
	[CreatedByUserId] [int] NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[ScreenshotAuditLog]    Script Date: 11/4/2026 3:32:14 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[ScreenshotAuditLog](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[ScreenshotId] [int] NOT NULL,
	[UserId] [int] NOT NULL,
	[Action] [varchar](20) NOT NULL,
	[ActionAt] [datetime2](7) NOT NULL,
	[IpAddress] [varchar](45) NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Screenshots]    Script Date: 11/4/2026 3:32:14 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Screenshots](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[DeviceId] [varchar](36) NOT NULL,
	[CapturedAt] [datetime2](7) NOT NULL,
	[UploadedAt] [datetime2](7) NOT NULL,
	[FilePath] [nvarchar](500) NOT NULL,
	[FileSizeBytes] [bigint] NOT NULL,
	[Width] [int] NULL,
	[Height] [int] NULL,
	[CapturedBy] [varchar](20) NOT NULL,
	[RequestedByUserId] [int] NULL,
	[DeletedAt] [datetime2](7) NULL,
	[Format] [varchar](4) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[SecurityAlertNotes]    Script Date: 11/4/2026 3:32:14 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[SecurityAlertNotes](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[AlertId] [int] NOT NULL,
	[UserId] [int] NULL,
	[Username] [nvarchar](100) NULL,
	[Note] [nvarchar](max) NOT NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[SecurityAlerts]    Script Date: 11/4/2026 3:32:14 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[SecurityAlerts](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[RuleId] [int] NULL,
	[ProtectedApplicationId] [int] NULL,
	[Category] [varchar](40) NOT NULL,
	[Severity] [varchar](20) NOT NULL,
	[Confidence] [int] NOT NULL,
	[RiskScore] [int] NOT NULL,
	[SourceIp] [varchar](45) NULL,
	[DestinationHost] [nvarchar](255) NULL,
	[RequestMethod] [varchar](10) NULL,
	[RequestPath] [nvarchar](2000) NULL,
	[ResponseStatus] [int] NULL,
	[UserAgent] [nvarchar](500) NULL,
	[UserAccount] [nvarchar](100) NULL,
	[EvidenceSummary] [nvarchar](2000) NULL,
	[RecommendedAction] [nvarchar](1000) NULL,
	[Status] [varchar](20) NOT NULL,
	[GroupingKey] [nvarchar](300) NOT NULL,
	[FirstSeenAt] [datetime2](7) NOT NULL,
	[LastSeenAt] [datetime2](7) NOT NULL,
	[OccurrenceCount] [int] NOT NULL,
	[SuppressedUntil] [datetime2](7) NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[UpdatedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[SecurityAlertStatusHistory]    Script Date: 11/4/2026 3:32:14 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[SecurityAlertStatusHistory](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[AlertId] [int] NOT NULL,
	[OldStatus] [varchar](20) NULL,
	[NewStatus] [varchar](20) NOT NULL,
	[ChangedByUserId] [int] NULL,
	[ChangedByUsername] [nvarchar](100) NULL,
	[Reason] [nvarchar](500) NULL,
	[ChangedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[SecurityCenterScoreSnapshots]    Script Date: 11/4/2026 3:32:14 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[SecurityCenterScoreSnapshots](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[SnapshotAt] [datetime2](7) NOT NULL,
	[OverallScore] [int] NOT NULL,
	[ComponentScoresJson] [nvarchar](max) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[SecurityCollectorHealth]    Script Date: 11/4/2026 3:32:15 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[SecurityCollectorHealth](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[LogSourceId] [int] NULL,
	[CheckedAt] [datetime2](7) NOT NULL,
	[Status] [varchar](20) NOT NULL,
	[Message] [nvarchar](500) NULL,
	[EventsProcessedLastRun] [int] NOT NULL,
	[DurationMs] [int] NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[SecurityDetectionRules]    Script Date: 11/4/2026 3:32:15 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[SecurityDetectionRules](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[RuleKey] [varchar](100) NOT NULL,
	[Name] [nvarchar](200) NOT NULL,
	[Description] [nvarchar](1000) NULL,
	[Category] [varchar](40) NOT NULL,
	[Severity] [varchar](20) NOT NULL,
	[Confidence] [int] NOT NULL,
	[DataSource] [varchar](40) NOT NULL,
	[Enabled] [bit] NOT NULL,
	[ConditionsJson] [nvarchar](max) NOT NULL,
	[ExclusionsJson] [nvarchar](max) NOT NULL,
	[ThresholdCount] [int] NOT NULL,
	[ThresholdWindowSeconds] [int] NOT NULL,
	[GroupingKeyTemplate] [nvarchar](200) NOT NULL,
	[CooldownSeconds] [int] NOT NULL,
	[Tags] [nvarchar](500) NULL,
	[RecommendedAction] [nvarchar](1000) NULL,
	[References_] [nvarchar](1000) NULL,
	[Version] [int] NOT NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[UpdatedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY],
UNIQUE NONCLUSTERED 
(
	[RuleKey] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[SecurityEvents]    Script Date: 11/4/2026 3:32:15 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[SecurityEvents](
	[Id] [bigint] IDENTITY(1,1) NOT NULL,
	[LogSourceId] [int] NULL,
	[ProtectedApplicationId] [int] NULL,
	[DataSource] [varchar](30) NOT NULL,
	[EventTime] [datetime2](7) NOT NULL,
	[SourceIp] [varchar](45) NULL,
	[DestinationHost] [nvarchar](255) NULL,
	[RequestMethod] [varchar](10) NULL,
	[RequestPath] [nvarchar](2000) NULL,
	[ResponseStatus] [int] NULL,
	[UserAgent] [nvarchar](500) NULL,
	[UserAccount] [nvarchar](100) NULL,
	[EvidenceSummary] [nvarchar](2000) NULL,
	[FieldsJson] [nvarchar](max) NULL,
	[AlertId] [int] NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[SecurityFileIntegrityBaselines]    Script Date: 11/4/2026 3:32:15 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[SecurityFileIntegrityBaselines](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[FilePath] [nvarchar](1000) NOT NULL,
	[Sha256Hash] [char](64) NOT NULL,
	[SizeBytes] [bigint] NOT NULL,
	[Permissions] [nvarchar](50) NULL,
	[ApprovedByUserId] [int] NULL,
	[LastVerifiedAt] [datetime2](7) NOT NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[SecurityFileIntegrityEvents]    Script Date: 11/4/2026 3:32:15 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[SecurityFileIntegrityEvents](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[FilePath] [nvarchar](1000) NOT NULL,
	[ChangeType] [varchar](20) NOT NULL,
	[OldHash] [char](64) NULL,
	[NewHash] [char](64) NULL,
	[DetectedAt] [datetime2](7) NOT NULL,
	[Acknowledged] [bit] NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[SecurityHeaderScans]    Script Date: 11/4/2026 3:32:15 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[SecurityHeaderScans](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[WebsiteId] [int] NULL,
	[TargetUrl] [nvarchar](1000) NOT NULL,
	[FinalUrl] [nvarchar](1000) NULL,
	[IpAddress] [varchar](45) NULL,
	[StatusCode] [int] NULL,
	[Grade] [varchar](5) NOT NULL,
	[Score] [int] NOT NULL,
	[HeadersJson] [nvarchar](max) NOT NULL,
	[MissingHeadersJson] [nvarchar](max) NOT NULL,
	[PresentHeadersJson] [nvarchar](max) NOT NULL,
	[ErrorMessage] [nvarchar](1000) NULL,
	[TriggeredByUserId] [int] NULL,
	[TriggeredByUsername] [nvarchar](100) NULL,
	[ScannedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[SecurityIncidents]    Script Date: 11/4/2026 3:32:15 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[SecurityIncidents](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[IncidentNumber] [varchar](20) NOT NULL,
	[Title] [nvarchar](300) NOT NULL,
	[Severity] [varchar](12) NOT NULL,
	[Status] [varchar](20) NOT NULL,
	[DeviceId] [varchar](36) NULL,
	[DeviceLabel] [nvarchar](200) NULL,
	[Description] [nvarchar](2000) NULL,
	[Resolution] [nvarchar](2000) NULL,
	[CreatedByUserId] [int] NULL,
	[CreatedByName] [nvarchar](100) NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[UpdatedAt] [datetime2](7) NOT NULL,
	[ResolvedAt] [datetime2](7) NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[SecurityIpAllowlist]    Script Date: 11/4/2026 3:32:15 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[SecurityIpAllowlist](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[IpOrCidr] [varchar](50) NOT NULL,
	[Reason] [nvarchar](500) NULL,
	[CreatedByUserId] [int] NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[ExpiresAt] [datetime2](7) NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[SecurityIpBlocklist]    Script Date: 11/4/2026 3:32:15 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[SecurityIpBlocklist](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[IpOrCidr] [varchar](50) NOT NULL,
	[Reason] [nvarchar](500) NULL,
	[Source] [varchar](20) NOT NULL,
	[CreatedByUserId] [int] NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[ExpiresAt] [datetime2](7) NULL,
	[IsActive] [bit] NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[SecurityIpProfiles]    Script Date: 11/4/2026 3:32:15 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[SecurityIpProfiles](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[IpAddress] [varchar](45) NOT NULL,
	[FirstSeenAt] [datetime2](7) NOT NULL,
	[LastSeenAt] [datetime2](7) NOT NULL,
	[TotalEvents] [int] NOT NULL,
	[TotalAlerts] [int] NOT NULL,
	[CountryCode] [char](2) NULL,
	[UpdatedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY],
UNIQUE NONCLUSTERED 
(
	[IpAddress] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[SecurityLogSources]    Script Date: 11/4/2026 3:32:15 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[SecurityLogSources](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[ProtectedApplicationId] [int] NOT NULL,
	[Name] [nvarchar](200) NOT NULL,
	[AdapterType] [varchar](40) NOT NULL,
	[Enabled] [bit] NOT NULL,
	[ConfigJson] [nvarchar](max) NOT NULL,
	[LastPositionFile] [nvarchar](1000) NULL,
	[LastPosition] [bigint] NOT NULL,
	[LastFileSize] [bigint] NULL,
	[LastFileInode] [nvarchar](100) NULL,
	[LastRunAt] [datetime2](7) NULL,
	[LastRunStatus] [varchar](20) NULL,
	[LastErrorMessage] [nvarchar](1000) NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[UpdatedAt] [datetime2](7) NOT NULL,
	[SourceDeviceId] [varchar](36) NULL,
	[SourceSiteName] [nvarchar](200) NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[SecurityNotificationChannels]    Script Date: 11/4/2026 3:32:15 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[SecurityNotificationChannels](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[ChannelType] [varchar](20) NOT NULL,
	[Name] [nvarchar](200) NOT NULL,
	[EncryptedConfig] [nvarchar](max) NULL,
	[Enabled] [bit] NOT NULL,
	[MinSeverity] [varchar](20) NOT NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[SecurityNotificationDeliveries]    Script Date: 11/4/2026 3:32:15 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[SecurityNotificationDeliveries](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[AlertId] [int] NULL,
	[ChannelId] [int] NULL,
	[ChannelType] [varchar](20) NOT NULL,
	[Status] [varchar](20) NOT NULL,
	[AttemptCount] [int] NOT NULL,
	[ErrorMessage] [nvarchar](1000) NULL,
	[SentAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[SecurityProtectedApplications]    Script Date: 11/4/2026 3:32:15 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[SecurityProtectedApplications](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[Name] [nvarchar](200) NOT NULL,
	[AppType] [varchar](30) NOT NULL,
	[BaseUrl] [nvarchar](500) NULL,
	[IsActive] [bit] NOT NULL,
	[Notes] [nvarchar](1000) NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[WebsiteId] [int] NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[SecurityResponseActions]    Script Date: 11/4/2026 3:32:15 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[SecurityResponseActions](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[AlertId] [int] NULL,
	[ActionType] [varchar](40) NOT NULL,
	[TargetValue] [nvarchar](200) NOT NULL,
	[Status] [varchar](20) NOT NULL,
	[DryRun] [bit] NOT NULL,
	[RequestedByUserId] [int] NULL,
	[RequestedByUsername] [nvarchar](100) NULL,
	[RequestedAt] [datetime2](7) NOT NULL,
	[ExecutedAt] [datetime2](7) NULL,
	[Result] [nvarchar](1000) NULL,
	[ExpiresAt] [datetime2](7) NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[SecurityRetentionSettings]    Script Date: 11/4/2026 3:32:15 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[SecurityRetentionSettings](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[DataType] [varchar](40) NOT NULL,
	[RetentionDays] [int] NOT NULL,
	[LastCleanupAt] [datetime2](7) NULL,
	[UpdatedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY],
UNIQUE NONCLUSTERED 
(
	[DataType] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[SecurityRuleExclusions]    Script Date: 11/4/2026 3:32:15 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[SecurityRuleExclusions](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[RuleId] [int] NULL,
	[ExclusionType] [varchar](20) NOT NULL,
	[Value] [nvarchar](500) NOT NULL,
	[Reason] [nvarchar](500) NULL,
	[CreatedByUserId] [int] NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[SecuritySettings]    Script Date: 11/4/2026 3:32:15 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[SecuritySettings](
	[Id] [int] NOT NULL,
	[PasswordMinLength] [int] NOT NULL,
	[PasswordRequireUppercase] [bit] NOT NULL,
	[PasswordRequireNumber] [bit] NOT NULL,
	[PasswordRequireSymbol] [bit] NOT NULL,
	[SsoEnabled] [bit] NOT NULL,
	[SsoProvider] [nvarchar](50) NULL,
	[SsoConfigJson] [nvarchar](max) NULL,
	[IpWhitelist] [nvarchar](max) NULL,
	[SessionTimeoutMinutes] [int] NULL,
	[LockoutThreshold] [int] NULL,
	[LockoutDurationMinutes] [int] NULL,
	[UpdatedAt] [datetime2](7) NOT NULL,
	[UpdatedByUserId] [int] NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[SecurityUserRoles]    Script Date: 11/4/2026 3:32:15 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[SecurityUserRoles](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[UserId] [int] NOT NULL,
	[Role] [varchar](20) NOT NULL,
	[GrantedByUserId] [int] NULL,
	[GrantedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY],
UNIQUE NONCLUSTERED 
(
	[UserId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[SeoScans]    Script Date: 11/4/2026 3:32:15 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[SeoScans](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[WebsiteId] [int] NULL,
	[TargetUrl] [nvarchar](1000) NOT NULL,
	[Score] [int] NOT NULL,
	[Grade] [varchar](5) NOT NULL,
	[FindingsJson] [nvarchar](max) NOT NULL,
	[ChecksJson] [nvarchar](max) NOT NULL,
	[TriggeredByUserId] [int] NULL,
	[TriggeredByUsername] [nvarchar](100) NULL,
	[ScannedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[ServerLogEntries]    Script Date: 11/4/2026 3:32:15 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[ServerLogEntries](
	[Id] [bigint] IDENTITY(1,1) NOT NULL,
	[DeviceId] [varchar](36) NOT NULL,
	[ReceivedAt] [datetime2](7) NOT NULL,
	[LogTimestamp] [datetime2](7) NULL,
	[LogSource] [varchar](30) NOT NULL,
	[Severity] [varchar](30) NULL,
	[Message] [nvarchar](2000) NULL,
	[RawLine] [nvarchar](max) NULL,
	[SiteName] [nvarchar](200) NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[ServerRoomEntries]    Script Date: 11/4/2026 3:32:15 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[ServerRoomEntries](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[StaffId] [int] NULL,
	[StaffName] [nvarchar](200) NOT NULL,
	[EntryAt] [datetime2](7) NOT NULL,
	[ExitAt] [datetime2](7) NULL,
	[ReasonCategory] [varchar](40) NOT NULL,
	[WorkPerformed] [nvarchar](2000) NULL,
	[IncidentNumber] [varchar](20) NULL,
	[RecordedByUserId] [int] NULL,
	[RecordedByName] [nvarchar](100) NULL,
	[ExitRecordedByName] [nvarchar](100) NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[SerialNumber] [nvarchar](100) NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[ServerRoomTasks]    Script Date: 11/4/2026 3:32:15 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[ServerRoomTasks](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[EntryId] [int] NULL,
	[StaffId] [int] NULL,
	[StaffName] [nvarchar](200) NOT NULL,
	[TaskGroup] [varchar](30) NOT NULL,
	[TaskType] [nvarchar](80) NOT NULL,
	[DeviceId] [varchar](36) NULL,
	[DeviceLabel] [nvarchar](200) NULL,
	[Description] [nvarchar](2000) NOT NULL,
	[StartAt] [datetime2](7) NOT NULL,
	[EndAt] [datetime2](7) NULL,
	[Status] [varchar](20) NOT NULL,
	[IncidentNumber] [varchar](20) NULL,
	[RecordedByUserId] [int] NULL,
	[RecordedByName] [nvarchar](100) NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[SlaConfigurations]    Script Date: 11/4/2026 3:32:15 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[SlaConfigurations](
	[MonitorId] [int] NOT NULL,
	[TargetPercent] [decimal](5, 2) NOT NULL,
	[EvaluationWindow] [varchar](10) NOT NULL,
	[LastBreachedPeriodStart] [datetime2](7) NULL,
PRIMARY KEY CLUSTERED 
(
	[MonitorId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[SliderImages]    Script Date: 11/4/2026 3:32:15 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[SliderImages](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[Title] [nvarchar](200) NULL,
	[Subtitle] [nvarchar](500) NULL,
	[ButtonText] [nvarchar](100) NULL,
	[ButtonUrl] [nvarchar](500) NULL,
	[ImagePath] [nvarchar](500) NOT NULL,
	[SortOrder] [int] NOT NULL,
	[Enabled] [bit] NOT NULL,
	[PublishStartAt] [datetime2](7) NULL,
	[PublishEndAt] [datetime2](7) NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[UpdatedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[SmtpSettings]    Script Date: 11/4/2026 3:32:15 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[SmtpSettings](
	[Id] [int] NOT NULL,
	[Host] [nvarchar](200) NULL,
	[Port] [int] NULL,
	[Username] [nvarchar](200) NULL,
	[Password] [nvarchar](500) NULL,
	[Encryption] [varchar](10) NULL,
	[SenderName] [nvarchar](150) NULL,
	[SenderEmail] [nvarchar](200) NULL,
	[ReplyTo] [nvarchar](200) NULL,
	[LastTestAt] [datetime2](7) NULL,
	[LastTestSuccess] [bit] NULL,
	[LastTestMessage] [nvarchar](500) NULL,
	[UpdatedAt] [datetime2](7) NOT NULL,
	[UpdatedByUserId] [int] NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[SoftwareInventory]    Script Date: 11/4/2026 3:32:15 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[SoftwareInventory](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[AssetId] [int] NOT NULL,
	[SoftwareName] [nvarchar](300) NOT NULL,
	[Publisher] [nvarchar](200) NULL,
	[InstalledVersion] [nvarchar](100) NULL,
	[LatestApprovedVersion] [nvarchar](100) NULL,
	[InstallationDate] [date] NULL,
	[InstalledBy] [nvarchar](200) NULL,
	[InstallationSource] [nvarchar](300) NULL,
	[LicenceType] [nvarchar](100) NULL,
	[LicenceKeyRef] [nvarchar](300) NULL,
	[LicenceExpiryDate] [date] NULL,
	[NumberOfLicences] [int] NULL,
	[BusinessOwner] [nvarchar](200) NULL,
	[TechnicalOwner] [nvarchar](200) NULL,
	[ApprovalStatus] [varchar](20) NOT NULL,
	[SoftwareStatus] [varchar](20) NOT NULL,
	[LastUpdatedDate] [date] NULL,
	[UninstallationDate] [date] NULL,
	[UninstalledBy] [nvarchar](200) NULL,
	[ReasonForRemoval] [nvarchar](500) NULL,
	[Notes] [nvarchar](max) NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[CreatedByUserId] [int] NULL,
	[CreatedByUsername] [nvarchar](100) NULL,
	[UpdatedAt] [datetime2](7) NOT NULL,
	[UpdatedByUserId] [int] NULL,
	[UpdatedByUsername] [nvarchar](100) NULL,
	[IsDeleted] [bit] NOT NULL,
	[DeletedAt] [datetime2](7) NULL,
	[DeletedByUserId] [int] NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[SophosClients]    Script Date: 11/4/2026 3:32:15 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[SophosClients](
	[IpAddress] [varchar](45) NOT NULL,
	[MacAddress] [varchar](20) NULL,
	[UpdatedAt] [datetime2](7) NOT NULL,
	[Hostname] [nvarchar](200) NULL,
	[Os] [nvarchar](50) NULL,
	[FirstSeen] [datetime2](7) NULL,
PRIMARY KEY CLUSTERED 
(
	[IpAddress] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[SophosEventLogs]    Script Date: 11/4/2026 3:32:15 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[SophosEventLogs](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[ReceivedAt] [datetime2](7) NOT NULL,
	[LogDate] [varchar](20) NULL,
	[LogTime] [varchar](20) NULL,
	[DeviceName] [nvarchar](200) NULL,
	[LogComponent] [nvarchar](50) NULL,
	[LogSubtype] [nvarchar](100) NULL,
	[Fields] [nvarchar](max) NULL,
	[RawMessage] [nvarchar](max) NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[SophosThreatLogs]    Script Date: 11/4/2026 3:32:15 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[SophosThreatLogs](
	[Id] [bigint] IDENTITY(1,1) NOT NULL,
	[ReceivedAt] [datetime2](7) NOT NULL,
	[LogDate] [varchar](20) NULL,
	[LogTime] [varchar](20) NULL,
	[DeviceName] [nvarchar](200) NULL,
	[LogType] [nvarchar](100) NULL,
	[LogComponent] [nvarchar](100) NULL,
	[LogSubtype] [nvarchar](100) NULL,
	[SrcIp] [varchar](45) NULL,
	[DstIp] [varchar](45) NULL,
	[Severity] [nvarchar](50) NULL,
	[Status] [nvarchar](50) NULL,
	[Fields] [nvarchar](max) NULL,
	[RawMessage] [nvarchar](max) NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[SpeedTestResults]    Script Date: 11/4/2026 3:32:15 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[SpeedTestResults](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[Category] [nvarchar](20) NOT NULL,
	[Target] [nvarchar](500) NOT NULL,
	[PingMs] [decimal](10, 2) NULL,
	[DownloadMbps] [decimal](10, 2) NULL,
	[UploadMbps] [decimal](10, 2) NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[SqlServerActiveSessions]    Script Date: 11/4/2026 3:32:15 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[SqlServerActiveSessions](
	[Id] [bigint] IDENTITY(1,1) NOT NULL,
	[InstanceId] [int] NOT NULL,
	[SessionId] [varchar](30) NOT NULL,
	[LoginName] [nvarchar](200) NULL,
	[HostName] [nvarchar](200) NULL,
	[ProgramName] [nvarchar](300) NULL,
	[DatabaseName] [nvarchar](200) NULL,
	[StatusText] [varchar](30) NULL,
	[CpuTimeMs] [bigint] NULL,
	[MemoryUsageKB] [bigint] NULL,
	[LastRequestStartTime] [datetime2](7) NULL,
	[UpdatedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[SqlServerBlockingEvents]    Script Date: 11/4/2026 3:32:15 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[SqlServerBlockingEvents](
	[Id] [bigint] IDENTITY(1,1) NOT NULL,
	[InstanceId] [int] NOT NULL,
	[DetectedAt] [datetime2](7) NOT NULL,
	[BlockedSessionId] [int] NOT NULL,
	[BlockingSessionId] [int] NOT NULL,
	[WaitTimeMs] [int] NULL,
	[WaitType] [nvarchar](100) NULL,
	[DatabaseName] [nvarchar](200) NULL,
	[BlockedQueryText] [nvarchar](2000) NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[SqlServerDatabaseSnapshots]    Script Date: 11/4/2026 3:32:15 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[SqlServerDatabaseSnapshots](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[InstanceId] [int] NOT NULL,
	[DatabaseName] [nvarchar](200) NOT NULL,
	[StateDesc] [varchar](30) NOT NULL,
	[RecoveryModel] [varchar](20) NULL,
	[DataSizeMB] [float] NULL,
	[LogSizeMB] [float] NULL,
	[LogUsedPercent] [float] NULL,
	[LastBackupAt] [datetime2](7) NULL,
	[LastBackupType] [varchar](10) NULL,
	[UpdatedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[SqlServerDeadlockEvents]    Script Date: 11/4/2026 3:32:15 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[SqlServerDeadlockEvents](
	[Id] [bigint] IDENTITY(1,1) NOT NULL,
	[InstanceId] [int] NOT NULL,
	[DetectedAt] [datetime2](7) NOT NULL,
	[Summary] [nvarchar](1000) NULL,
	[DeadlockGraphXml] [nvarchar](max) NULL,
	[ReceivedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[SqlServerInstances]    Script Date: 11/4/2026 3:32:15 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[SqlServerInstances](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[Name] [nvarchar](200) NOT NULL,
	[HostName] [nvarchar](255) NOT NULL,
	[Port] [int] NOT NULL,
	[AuthType] [varchar](20) NOT NULL,
	[SqlUsername] [nvarchar](200) NULL,
	[SqlPasswordEncrypted] [nvarchar](500) NULL,
	[IsSelfMonitoring] [bit] NOT NULL,
	[Enabled] [bit] NOT NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[LastCheckAt] [datetime2](7) NULL,
	[LastCheckStatus] [varchar](20) NULL,
	[LastErrorMessage] [nvarchar](1000) NULL,
	[Engine] [varchar](20) NOT NULL,
	[LastDownAlertAt] [datetime2](7) NULL,
	[SshHost] [nvarchar](255) NULL,
	[SshPort] [int] NULL,
	[SshUsername] [nvarchar](200) NULL,
	[SshPasswordEncrypted] [nvarchar](max) NULL,
	[BackupBaseDir] [nvarchar](500) NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[SqlServerMetricsSnapshots]    Script Date: 11/4/2026 3:32:15 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[SqlServerMetricsSnapshots](
	[Id] [bigint] IDENTITY(1,1) NOT NULL,
	[InstanceId] [int] NOT NULL,
	[ReceivedAt] [datetime2](7) NOT NULL,
	[IsAvailable] [bit] NOT NULL,
	[CpuPct] [float] NULL,
	[MemoryUsedMB] [float] NULL,
	[MemoryTargetMB] [float] NULL,
	[BufferCacheHitRatio] [float] NULL,
	[PageLifeExpectancy] [int] NULL,
	[ActiveSessionCount] [int] NULL,
	[BlockingSessionCount] [int] NULL,
	[DeadlockCountCumulative] [bigint] NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[SqlServerSlowQueries]    Script Date: 11/4/2026 3:32:15 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[SqlServerSlowQueries](
	[Id] [bigint] IDENTITY(1,1) NOT NULL,
	[InstanceId] [int] NOT NULL,
	[DetectedAt] [datetime2](7) NOT NULL,
	[DatabaseName] [nvarchar](200) NULL,
	[QueryText] [nvarchar](max) NULL,
	[AvgDurationMs] [float] NOT NULL,
	[ExecutionCount] [bigint] NOT NULL,
	[LastExecutedAt] [datetime2](7) NULL,
	[RankBy] [varchar](10) NOT NULL,
	[AvgCpuTimeMs] [float] NULL,
	[MaxUsedGrantKB] [float] NULL,
	[AvgLogicalReads] [float] NULL,
	[AvgLogicalWrites] [float] NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[SslCertificateRecords]    Script Date: 11/4/2026 3:32:15 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[SslCertificateRecords](
	[MonitorId] [int] NOT NULL,
	[Domain] [nvarchar](300) NULL,
	[Issuer] [nvarchar](500) NULL,
	[Subject] [nvarchar](500) NULL,
	[ValidFrom] [datetime2](7) NULL,
	[ExpiresAt] [datetime2](7) NULL,
	[HostnameMatch] [bit] NULL,
	[ChainValid] [bit] NULL,
	[SelfSigned] [bit] NULL,
	[TlsProtocol] [varchar](20) NULL,
	[SignatureAlgorithm] [varchar](100) NULL,
	[LastCheckedAt] [datetime2](7) NULL,
	[LastAlertThresholdDays] [int] NULL,
PRIMARY KEY CLUSTERED 
(
	[MonitorId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Staff]    Script Date: 11/4/2026 3:32:15 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Staff](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[Name] [nvarchar](200) NOT NULL,
	[MacAddress] [varchar](20) NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[UpdatedAt] [datetime2](7) NOT NULL,
	[Email] [nvarchar](255) NULL,
	[Phone] [nvarchar](30) NULL,
	[Department] [nvarchar](100) NULL,
	[Position] [nvarchar](100) NULL,
	[Address] [nvarchar](500) NULL,
	[PhotoPath] [nvarchar](500) NULL,
	[DepartmentId] [int] NULL,
	[TeamId] [int] NULL,
	[BranchOfficeId] [int] NULL,
	[JobDesignationId] [int] NULL,
	[ComputerNameOverride] [nvarchar](255) NULL,
	[AdObjectGuid] [varchar](36) NULL,
	[AdSamAccountName] [nvarchar](100) NULL,
	[AdDisabled] [bit] NOT NULL,
	[AdSyncedAt] [datetime2](7) NULL,
	[WacGroupId] [int] NULL,
	[EmploymentStatus] [nvarchar](30) NOT NULL,
	[GitLabUsername] [nvarchar](255) NULL,
	[GitLabUserId] [int] NULL,
	[GlesysMailbox] [nvarchar](255) NULL,
	[OffboardingDate] [date] NULL,
	[AgentQaUserId] [nvarchar](100) NULL,
	[TeamworkEmail] [nvarchar](255) NULL,
	[LogMonitorUsername] [nvarchar](100) NULL,
	[AdUsername] [nvarchar](100) NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[SupportTicketNotes]    Script Date: 11/4/2026 3:32:15 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[SupportTicketNotes](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[TicketId] [int] NOT NULL,
	[AuthorUserId] [int] NULL,
	[Message] [nvarchar](max) NOT NULL,
	[IsInternal] [bit] NOT NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[SupportTickets]    Script Date: 11/4/2026 3:32:15 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[SupportTickets](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[TicketNumber] [varchar](20) NOT NULL,
	[Name] [nvarchar](200) NOT NULL,
	[Email] [nvarchar](200) NOT NULL,
	[Subject] [nvarchar](300) NOT NULL,
	[Category] [nvarchar](50) NOT NULL,
	[Priority] [varchar](20) NOT NULL,
	[Description] [nvarchar](max) NOT NULL,
	[AttachmentPath] [nvarchar](500) NULL,
	[AttachmentOriginalName] [nvarchar](300) NULL,
	[Status] [varchar](20) NOT NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[UpdatedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY],
UNIQUE NONCLUSTERED 
(
	[TicketNumber] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[SystemHealthLogs]    Script Date: 11/4/2026 3:32:15 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[SystemHealthLogs](
	[Id] [bigint] IDENTITY(1,1) NOT NULL,
	[ReceivedAt] [datetime2](7) NOT NULL,
	[LogDate] [varchar](20) NULL,
	[LogTime] [varchar](20) NULL,
	[DeviceName] [nvarchar](100) NULL,
	[LogComponent] [nvarchar](100) NULL,
	[LogSubtype] [nvarchar](100) NULL,
	[Fields] [nvarchar](max) NULL,
	[RawMessage] [nvarchar](max) NULL,
	[InterfaceName]  AS (CONVERT([nvarchar](50),json_value([Fields],'$.interface'))) PERSISTED,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Teams]    Script Date: 11/4/2026 3:32:15 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Teams](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[Name] [nvarchar](150) NOT NULL,
	[DepartmentId] [int] NULL,
	[Description] [nvarchar](500) NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[UpdatedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[ThreatScans]    Script Date: 11/4/2026 3:32:15 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[ThreatScans](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[Kind] [varchar](10) NOT NULL,
	[Target] [nvarchar](1000) NOT NULL,
	[WebsiteId] [int] NULL,
	[VtAnalysisId] [nvarchar](300) NULL,
	[VtResourceId] [nvarchar](300) NULL,
	[Status] [varchar](20) NOT NULL,
	[Verdict] [varchar](20) NULL,
	[MaliciousCount] [int] NULL,
	[SuspiciousCount] [int] NULL,
	[HarmlessCount] [int] NULL,
	[UndetectedCount] [int] NULL,
	[TimeoutCount] [int] NULL,
	[EngineCount] [int] NULL,
	[ResultJson] [nvarchar](max) NULL,
	[ErrorMessage] [nvarchar](1000) NULL,
	[OriginalFileName] [nvarchar](500) NULL,
	[ContentType] [nvarchar](200) NULL,
	[SizeBytes] [bigint] NULL,
	[FilePath] [nvarchar](500) NULL,
	[TriggeredByUserId] [int] NULL,
	[TriggeredByUsername] [nvarchar](100) NULL,
	[StartedAt] [datetime2](7) NULL,
	[CompletedAt] [datetime2](7) NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[UpdateHistory]    Script Date: 11/4/2026 3:32:16 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[UpdateHistory](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[DeviceId] [varchar](36) NULL,
	[Hostname] [nvarchar](200) NULL,
	[OS] [varchar](20) NULL,
	[EventType] [varchar](30) NOT NULL,
	[UpdateKey] [nvarchar](300) NULL,
	[Title] [nvarchar](500) NULL,
	[Category] [varchar](20) NULL,
	[Detail] [nvarchar](1000) NULL,
	[ActorUserId] [int] NULL,
	[ActorName] [nvarchar](100) NULL,
	[RequestId] [int] NULL,
	[IncidentNumber] [varchar](20) NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[UpdateInstallResults]    Script Date: 11/4/2026 3:32:16 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[UpdateInstallResults](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[RequestId] [int] NOT NULL,
	[DeviceId] [varchar](36) NOT NULL,
	[UpdateKey] [nvarchar](300) NOT NULL,
	[Title] [nvarchar](500) NULL,
	[Outcome] [varchar](12) NOT NULL,
	[Message] [nvarchar](1000) NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[UpdateSchedules]    Script Date: 11/4/2026 3:32:16 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[UpdateSchedules](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[Name] [nvarchar](200) NOT NULL,
	[Recurrence] [varchar](10) NOT NULL,
	[NextRunAt] [datetime2](7) NULL,
	[Categories] [nvarchar](200) NOT NULL,
	[IncludeDisruptive] [bit] NOT NULL,
	[ConfirmedByUserId] [int] NULL,
	[ConfirmedByName] [nvarchar](100) NULL,
	[ConfirmedAt] [datetime2](7) NULL,
	[IsActive] [bit] NOT NULL,
	[IsDeleted] [bit] NOT NULL,
	[LastRunAt] [datetime2](7) NULL,
	[LastRunSummary] [nvarchar](500) NULL,
	[CreatedByUserId] [int] NULL,
	[CreatedByName] [nvarchar](100) NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[UpdateScheduleTargets]    Script Date: 11/4/2026 3:32:16 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[UpdateScheduleTargets](
	[ScheduleId] [int] NOT NULL,
	[DeviceId] [varchar](36) NOT NULL,
 CONSTRAINT [PK_UpdateScheduleTargets] PRIMARY KEY CLUSTERED 
(
	[ScheduleId] ASC,
	[DeviceId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[UsbDevicePolicies]    Script Date: 11/4/2026 3:32:16 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[UsbDevicePolicies](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[Action] [varchar](10) NOT NULL,
	[VendorId] [varchar](20) NULL,
	[SerialNumber] [nvarchar](100) NULL,
	[DeviceNamePattern] [nvarchar](200) NULL,
	[Reason] [nvarchar](500) NULL,
	[CreatedByUserId] [int] NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[IsActive] [bit] NOT NULL,
	[ProductId] [varchar](20) NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[UserGroupMembers]    Script Date: 11/4/2026 3:32:16 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[UserGroupMembers](
	[UserId] [int] NOT NULL,
	[GroupId] [int] NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[UserId] ASC,
	[GroupId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[UserGroups]    Script Date: 11/4/2026 3:32:16 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[UserGroups](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[Name] [nvarchar](150) NOT NULL,
	[Description] [nvarchar](500) NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[UpdatedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[UserMenuAccess]    Script Date: 11/4/2026 3:32:16 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[UserMenuAccess](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[UserId] [int] NOT NULL,
	[MenuKey] [nvarchar](150) NOT NULL,
	[Allowed] [bit] NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY],
 CONSTRAINT [UQ_UserMenuAccess] UNIQUE NONCLUSTERED 
(
	[UserId] ASC,
	[MenuKey] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[UserPasskeys]    Script Date: 11/4/2026 3:32:16 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[UserPasskeys](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[UserId] [int] NOT NULL,
	[CredentialId] [nvarchar](255) NOT NULL,
	[PublicKey] [nvarchar](max) NOT NULL,
	[Counter] [bigint] NOT NULL,
	[Transports] [nvarchar](100) NULL,
	[DeviceLabel] [nvarchar](100) NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[LastUsedAt] [datetime2](7) NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY],
 CONSTRAINT [UQ_UserPasskeys_CredentialId] UNIQUE NONCLUSTERED 
(
	[CredentialId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Users]    Script Date: 11/4/2026 3:32:16 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Users](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[Username] [nvarchar](100) NOT NULL,
	[PasswordHash] [nvarchar](255) NOT NULL,
	[Role] [nvarchar](50) NOT NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[Email] [nvarchar](200) NULL,
	[FullName] [nvarchar](200) NULL,
	[DepartmentId] [int] NULL,
	[TeamId] [int] NULL,
	[BranchOfficeId] [int] NULL,
	[JobDesignationId] [int] NULL,
	[RoleId] [int] NULL,
	[IsActive] [bit] NOT NULL,
	[MfaRequired] [bit] NOT NULL,
	[MfaEnrolledAt] [datetime2](7) NULL,
	[PendingOtpCodeHash] [nvarchar](255) NULL,
	[PendingOtpExpiresAt] [datetime2](7) NULL,
	[PendingOtpAttempts] [int] NOT NULL,
	[PasswordChangedAt] [datetime2](7) NULL,
	[RecoveryPhone] [nvarchar](30) NULL,
	[RecoveryEmail] [nvarchar](200) NULL,
	[SkipPasswordWhenPossible] [bit] NOT NULL,
	[TotpSecretEncrypted] [nvarchar](500) NULL,
	[TotpEnabled] [bit] NOT NULL,
	[TotpEnrolledAt] [datetime2](7) NULL,
	[CommitTokenHash] [nvarchar](64) NULL,
	[CommitTokenExpiresAt] [datetime2](7) NULL,
	[MustChangePassword] [bit] NOT NULL,
	[FailedLoginAttempts] [int] NOT NULL,
	[LockedUntil] [datetime2](7) NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY],
UNIQUE NONCLUSTERED 
(
	[Username] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[UserTotpRecoveryCodes]    Script Date: 11/4/2026 3:32:16 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[UserTotpRecoveryCodes](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[UserId] [int] NOT NULL,
	[CodeHash] [nvarchar](255) NOT NULL,
	[UsedAt] [datetime2](7) NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[VulnerabilityFindings]    Script Date: 11/4/2026 3:32:16 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[VulnerabilityFindings](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[ScanId] [int] NOT NULL,
	[CheckType] [varchar](60) NOT NULL,
	[Severity] [varchar](20) NOT NULL,
	[CvssScore] [decimal](3, 1) NULL,
	[Cwe] [varchar](20) NULL,
	[Cve] [varchar](30) NULL,
	[Title] [nvarchar](300) NOT NULL,
	[Description] [nvarchar](max) NULL,
	[Risk] [nvarchar](max) NULL,
	[Evidence] [nvarchar](max) NULL,
	[AffectedUrl] [nvarchar](2000) NULL,
	[Parameter] [nvarchar](200) NULL,
	[HttpRequestSnippet] [nvarchar](max) NULL,
	[HttpResponseSnippet] [nvarchar](max) NULL,
	[Remediation] [nvarchar](max) NULL,
	[ReferencesJson] [nvarchar](max) NULL,
	[Status] [varchar](20) NOT NULL,
	[AssignedEngineerUserId] [int] NULL,
	[Notes] [nvarchar](max) NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[UpdatedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[VulnerabilityScans]    Script Date: 11/4/2026 3:32:16 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[VulnerabilityScans](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[WebsiteId] [int] NULL,
	[TargetUrl] [nvarchar](2000) NOT NULL,
	[IsAdHocTarget] [bit] NOT NULL,
	[AuthorizedByUserId] [int] NULL,
	[Status] [varchar](20) NOT NULL,
	[StartedAt] [datetime2](7) NULL,
	[CompletedAt] [datetime2](7) NULL,
	[ChecksRun] [int] NOT NULL,
	[RequestedByUserId] [int] NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[ScanType] [varchar](20) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[WacCriticalAllowlist]    Script Date: 11/4/2026 3:32:16 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[WacCriticalAllowlist](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[ServiceName] [nvarchar](200) NOT NULL,
	[Domain] [nvarchar](255) NULL,
	[IpAddress] [varchar](45) NULL,
	[Port] [int] NULL,
	[MatchType] [varchar](10) NOT NULL,
	[IsCritical] [bit] NOT NULL,
	[Notes] [nvarchar](1000) NULL,
	[CreatedByUserId] [int] NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[UpdatedByUserId] [int] NULL,
	[UpdatedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[WacGroups]    Script Date: 11/4/2026 3:32:16 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[WacGroups](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[Name] [nvarchar](100) NOT NULL,
	[Description] [nvarchar](500) NULL,
	[IsBuiltIn] [bit] NOT NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[UpdatedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY],
UNIQUE NONCLUSTERED 
(
	[Name] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[WacSchedules]    Script Date: 11/4/2026 3:32:16 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[WacSchedules](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[Name] [nvarchar](100) NOT NULL,
	[DaysOfWeek] [varchar](20) NULL,
	[StartTime] [time](7) NULL,
	[EndTime] [time](7) NULL,
	[IsBuiltIn] [bit] NOT NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[WacSyncStatus]    Script Date: 11/4/2026 3:32:16 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[WacSyncStatus](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[PolicyType] [varchar](20) NOT NULL,
	[PolicyId] [int] NOT NULL,
	[Status] [varchar](20) NOT NULL,
	[LastAttemptAt] [datetime2](7) NULL,
	[LastSuccessAt] [datetime2](7) NULL,
	[ErrorMessage] [nvarchar](1000) NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[WacWebsiteRules]    Script Date: 11/4/2026 3:32:16 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[WacWebsiteRules](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[Domain] [nvarchar](255) NOT NULL,
	[MatchType] [varchar](10) NOT NULL,
	[Action] [varchar](10) NOT NULL,
	[ScopeType] [varchar](10) NOT NULL,
	[StaffId] [int] NULL,
	[WacGroupId] [int] NULL,
	[ScheduleId] [int] NULL,
	[Priority] [varchar](10) NOT NULL,
	[Status] [varchar](10) NOT NULL,
	[CreatedByUserId] [int] NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[UpdatedByUserId] [int] NULL,
	[UpdatedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[WafApplications]    Script Date: 11/4/2026 3:32:16 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[WafApplications](
	[Id] [bigint] IDENTITY(1,1) NOT NULL,
	[Name] [nvarchar](200) NOT NULL,
	[Description] [nvarchar](max) NULL,
	[PublicDomain] [nvarchar](255) NOT NULL,
	[OriginServer] [nvarchar](255) NOT NULL,
	[OriginPort] [int] NOT NULL,
	[HttpsEnabled] [bit] NOT NULL,
	[HealthCheckUrl] [nvarchar](500) NULL,
	[Status] [nvarchar](20) NOT NULL,
	[WafMode] [nvarchar](20) NOT NULL,
	[CreatedByUserId] [int] NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[UpdatedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY],
 CONSTRAINT [UQ_WafApplications_PublicDomain] UNIQUE NONCLUSTERED 
(
	[PublicDomain] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[WafAttackEvents]    Script Date: 11/4/2026 3:32:16 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[WafAttackEvents](
	[Id] [bigint] IDENTITY(1,1) NOT NULL,
	[EventTimestamp] [datetime2](7) NOT NULL,
	[ApplicationId] [bigint] NOT NULL,
	[SourceIp] [varchar](45) NOT NULL,
	[Country] [varchar](2) NULL,
	[HttpMethod] [nvarchar](10) NOT NULL,
	[RequestUrl] [nvarchar](2000) NOT NULL,
	[RuleId] [bigint] NULL,
	[RuleName] [nvarchar](200) NULL,
	[AttackCategory] [nvarchar](50) NULL,
	[Severity] [nvarchar](20) NOT NULL,
	[Action] [nvarchar](20) NOT NULL,
	[HttpStatus] [int] NOT NULL,
	[UserAgent] [nvarchar](500) NULL,
	[RequestId] [varchar](40) NOT NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[WafCertificates]    Script Date: 11/4/2026 3:32:16 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[WafCertificates](
	[Id] [bigint] IDENTITY(1,1) NOT NULL,
	[Domain] [nvarchar](255) NOT NULL,
	[Issuer] [nvarchar](255) NULL,
	[ExpirationDate] [date] NULL,
	[Status] [nvarchar](20) NOT NULL,
	[LastChecked] [datetime2](7) NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[UpdatedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY],
 CONSTRAINT [UQ_WafCertificates_Domain] UNIQUE NONCLUSTERED 
(
	[Domain] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[WafCountryRules]    Script Date: 11/4/2026 3:32:16 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[WafCountryRules](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[CountryCode] [char](2) NOT NULL,
	[Action] [varchar](20) NOT NULL,
	[IsActive] [bit] NOT NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[WafCustomRules]    Script Date: 11/4/2026 3:32:16 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[WafCustomRules](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[Name] [nvarchar](200) NOT NULL,
	[MatchType] [varchar](20) NOT NULL,
	[MatchValue] [nvarchar](1000) NOT NULL,
	[Action] [varchar](20) NOT NULL,
	[IsActive] [bit] NOT NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[WafHealthChecks]    Script Date: 11/4/2026 3:32:16 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[WafHealthChecks](
	[Id] [bigint] IDENTITY(1,1) NOT NULL,
	[ApplicationId] [bigint] NOT NULL,
	[CheckedAt] [datetime2](7) NOT NULL,
	[Status] [nvarchar](20) NOT NULL,
	[ResponseTimeMs] [int] NULL,
	[HttpStatus] [int] NULL,
	[ErrorMessage] [nvarchar](max) NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[WafIpRules]    Script Date: 11/4/2026 3:32:16 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[WafIpRules](
	[Id] [bigint] IDENTITY(1,1) NOT NULL,
	[IpOrCidr] [varchar](50) NOT NULL,
	[Type] [nvarchar](10) NOT NULL,
	[Reason] [nvarchar](max) NULL,
	[IsTemporary] [bit] NOT NULL,
	[ExpiresAt] [datetime2](7) NULL,
	[CreatedByUserId] [int] NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[WafRateLimitRules]    Script Date: 11/4/2026 3:32:16 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[WafRateLimitRules](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[WebsiteId] [int] NULL,
	[Name] [nvarchar](200) NOT NULL,
	[RequestsPerWindow] [int] NOT NULL,
	[WindowSeconds] [int] NOT NULL,
	[Action] [varchar](20) NOT NULL,
	[IsActive] [bit] NOT NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[WafRateLimits]    Script Date: 11/4/2026 3:32:16 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[WafRateLimits](
	[Id] [bigint] IDENTITY(1,1) NOT NULL,
	[ApplicationId] [bigint] NOT NULL,
	[Path] [nvarchar](500) NOT NULL,
	[HttpMethod] [nvarchar](10) NULL,
	[RequestLimit] [int] NOT NULL,
	[WindowSeconds] [int] NOT NULL,
	[Action] [nvarchar](20) NOT NULL,
	[Enabled] [bit] NOT NULL,
	[CreatedByUserId] [int] NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[UpdatedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[WafRequestLogs]    Script Date: 11/4/2026 3:32:16 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[WafRequestLogs](
	[Id] [bigint] IDENTITY(1,1) NOT NULL,
	[RequestId] [varchar](40) NOT NULL,
	[ApplicationId] [bigint] NOT NULL,
	[EventTimestamp] [datetime2](7) NOT NULL,
	[SourceIp] [varchar](45) NOT NULL,
	[HttpMethod] [nvarchar](10) NOT NULL,
	[RequestUrl] [nvarchar](2000) NOT NULL,
	[HttpStatus] [int] NOT NULL,
	[ResponseTimeMs] [int] NULL,
	[Action] [nvarchar](20) NOT NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[WafRuleExceptions]    Script Date: 11/4/2026 3:32:16 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[WafRuleExceptions](
	[Id] [bigint] IDENTITY(1,1) NOT NULL,
	[RuleId] [bigint] NOT NULL,
	[ApplicationId] [bigint] NULL,
	[Path] [nvarchar](500) NULL,
	[ParameterName] [nvarchar](200) NULL,
	[Reason] [nvarchar](max) NULL,
	[CreatedByUserId] [int] NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[WafRules]    Script Date: 11/4/2026 3:32:16 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[WafRules](
	[Id] [bigint] IDENTITY(1,1) NOT NULL,
	[RuleName] [nvarchar](200) NOT NULL,
	[Description] [nvarchar](max) NULL,
	[Category] [nvarchar](50) NOT NULL,
	[Severity] [nvarchar](20) NOT NULL,
	[Pattern] [nvarchar](max) NOT NULL,
	[Target] [nvarchar](30) NOT NULL,
	[Action] [nvarchar](20) NOT NULL,
	[Enabled] [bit] NOT NULL,
	[Mode] [nvarchar](20) NOT NULL,
	[ApplicationId] [bigint] NULL,
	[EndpointPath] [nvarchar](500) NULL,
	[CreatedByUserId] [int] NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[UpdatedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[WafSettings]    Script Date: 11/4/2026 3:32:16 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[WafSettings](
	[Id] [int] NOT NULL,
	[AttackEventRetentionDays] [int] NOT NULL,
	[RequestLogRetentionDays] [int] NOT NULL,
	[TrustedProxyIpsJson] [nvarchar](max) NULL,
	[UpdatedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[WatchedFiles]    Script Date: 11/4/2026 3:32:16 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[WatchedFiles](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[DeviceId] [varchar](36) NOT NULL,
	[FilePath] [nvarchar](500) NOT NULL,
	[Enabled] [bit] NOT NULL,
	[CreatedByUserId] [int] NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[WazuhOfficeAgentVulnerabilities]    Script Date: 11/4/2026 3:32:16 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[WazuhOfficeAgentVulnerabilities](
	[Id] [bigint] IDENTITY(1,1) NOT NULL,
	[DeviceId] [varchar](36) NOT NULL,
	[VulnerabilityId] [bigint] NOT NULL,
	[InstalledVersion] [nvarchar](100) NULL,
	[Status] [nvarchar](20) NOT NULL,
	[DetectedAt] [datetime2](7) NOT NULL,
	[ResolvedAt] [datetime2](7) NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[WazuhOfficeAlertComments]    Script Date: 11/4/2026 3:32:16 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[WazuhOfficeAlertComments](
	[Id] [bigint] IDENTITY(1,1) NOT NULL,
	[AlertId] [bigint] NOT NULL,
	[UserId] [int] NOT NULL,
	[CommentText] [nvarchar](max) NOT NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[WazuhOfficeAlerts]    Script Date: 11/4/2026 3:32:16 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[WazuhOfficeAlerts](
	[Id] [bigint] IDENTITY(1,1) NOT NULL,
	[TriggeredAt] [datetime2](7) NOT NULL,
	[DeviceId] [varchar](36) NOT NULL,
	[RuleId] [bigint] NULL,
	[SecurityEventId] [bigint] NULL,
	[Severity] [nvarchar](20) NOT NULL,
	[Description] [nvarchar](max) NOT NULL,
	[SourceIp] [varchar](45) NULL,
	[Username] [nvarchar](200) NULL,
	[MitreTechnique] [varchar](20) NULL,
	[Status] [nvarchar](20) NOT NULL,
	[AssignedAnalystUserId] [int] NULL,
	[ResolutionNotes] [nvarchar](max) NULL,
	[UpdatedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[WazuhOfficeCpuMetrics]    Script Date: 11/4/2026 3:32:16 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[WazuhOfficeCpuMetrics](
	[Id] [bigint] IDENTITY(1,1) NOT NULL,
	[DeviceId] [varchar](36) NOT NULL,
	[CpuPercent] [float] NOT NULL,
	[CapturedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[WazuhOfficeDiskMetrics]    Script Date: 11/4/2026 3:32:16 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[WazuhOfficeDiskMetrics](
	[Id] [bigint] IDENTITY(1,1) NOT NULL,
	[DeviceId] [varchar](36) NOT NULL,
	[DriveLabel] [nvarchar](200) NULL,
	[UsedGb] [float] NULL,
	[TotalGb] [float] NULL,
	[UsedPercent] [float] NOT NULL,
	[CapturedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[WazuhOfficeFileIntegrityEvents]    Script Date: 11/4/2026 3:32:16 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[WazuhOfficeFileIntegrityEvents](
	[Id] [bigint] IDENTITY(1,1) NOT NULL,
	[DeviceId] [varchar](36) NOT NULL,
	[FilePath] [nvarchar](500) NOT NULL,
	[ChangeType] [nvarchar](20) NOT NULL,
	[OldHash] [varchar](64) NULL,
	[NewHash] [varchar](64) NULL,
	[ChangedByUser] [nvarchar](200) NULL,
	[DetectedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[WazuhOfficeInventorySnapshots]    Script Date: 11/4/2026 3:32:16 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[WazuhOfficeInventorySnapshots](
	[Id] [bigint] IDENTITY(1,1) NOT NULL,
	[DeviceId] [varchar](36) NOT NULL,
	[Hostname] [nvarchar](200) NULL,
	[Os] [nvarchar](100) NULL,
	[OsVersion] [nvarchar](100) NULL,
	[Kernel] [nvarchar](100) NULL,
	[Cpu] [nvarchar](200) NULL,
	[RamMb] [int] NULL,
	[DiskGb] [int] NULL,
	[IpAddressesJson] [nvarchar](max) NULL,
	[MacAddressesJson] [nvarchar](max) NULL,
	[InstalledSoftwareJson] [nvarchar](max) NULL,
	[UsersJson] [nvarchar](max) NULL,
	[GroupsJson] [nvarchar](max) NULL,
	[CapturedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[WazuhOfficeMemoryMetrics]    Script Date: 11/4/2026 3:32:16 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[WazuhOfficeMemoryMetrics](
	[Id] [bigint] IDENTITY(1,1) NOT NULL,
	[DeviceId] [varchar](36) NOT NULL,
	[MemoryPercent] [float] NOT NULL,
	[UsedMb] [int] NULL,
	[TotalMb] [int] NULL,
	[CapturedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[WazuhOfficeMitreTactics]    Script Date: 11/4/2026 3:32:16 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[WazuhOfficeMitreTactics](
	[TacticId] [varchar](20) NOT NULL,
	[TacticName] [nvarchar](200) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[TacticId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[WazuhOfficeMitreTechniques]    Script Date: 11/4/2026 3:32:16 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[WazuhOfficeMitreTechniques](
	[TechniqueId] [varchar](20) NOT NULL,
	[TechniqueName] [nvarchar](200) NOT NULL,
	[TacticId] [varchar](20) NULL,
PRIMARY KEY CLUSTERED 
(
	[TechniqueId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[WazuhOfficeNetworkConnections]    Script Date: 11/4/2026 3:32:16 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[WazuhOfficeNetworkConnections](
	[Id] [bigint] IDENTITY(1,1) NOT NULL,
	[DeviceId] [varchar](36) NOT NULL,
	[InterfaceName] [nvarchar](100) NULL,
	[LocalIp] [varchar](45) NULL,
	[LocalPort] [int] NULL,
	[RemoteIp] [varchar](45) NULL,
	[RemotePort] [int] NULL,
	[Protocol] [nvarchar](20) NULL,
	[ConnectionState] [nvarchar](50) NULL,
	[ProcessName] [nvarchar](260) NULL,
	[ProcessId] [int] NULL,
	[CapturedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[WazuhOfficeNotificationCooldowns]    Script Date: 11/4/2026 3:32:16 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[WazuhOfficeNotificationCooldowns](
	[Id] [bigint] IDENTITY(1,1) NOT NULL,
	[RuleId] [bigint] NULL,
	[DeviceId] [varchar](36) NULL,
	[ChannelType] [nvarchar](30) NOT NULL,
	[LastSentAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[WazuhOfficeProcesses]    Script Date: 11/4/2026 3:32:16 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[WazuhOfficeProcesses](
	[Id] [bigint] IDENTITY(1,1) NOT NULL,
	[DeviceId] [varchar](36) NOT NULL,
	[ProcessName] [nvarchar](1000) NULL,
	[Pid] [int] NOT NULL,
	[Username] [nvarchar](200) NULL,
	[CpuPercent] [float] NULL,
	[MemoryPercent] [float] NULL,
	[StartTime] [datetime2](7) NULL,
	[ExecutablePath] [nvarchar](1000) NULL,
	[CommandLine] [nvarchar](max) NULL,
	[CapturedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[WazuhOfficeRules]    Script Date: 11/4/2026 3:32:17 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[WazuhOfficeRules](
	[Id] [bigint] IDENTITY(1,1) NOT NULL,
	[RuleName] [nvarchar](200) NOT NULL,
	[Description] [nvarchar](max) NULL,
	[Category] [nvarchar](50) NULL,
	[Severity] [nvarchar](20) NOT NULL,
	[EventSource] [nvarchar](50) NULL,
	[ConditionsJson] [nvarchar](max) NOT NULL,
	[ThresholdCount] [int] NULL,
	[TimeWindowMinutes] [int] NULL,
	[MitreTactic] [varchar](20) NULL,
	[MitreTechnique] [varchar](20) NULL,
	[Tags] [nvarchar](500) NULL,
	[Enabled] [bit] NOT NULL,
	[CreatedByUserId] [int] NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[UpdatedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[WazuhOfficeSecurityEvents]    Script Date: 11/4/2026 3:32:17 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[WazuhOfficeSecurityEvents](
	[Id] [bigint] IDENTITY(1,1) NOT NULL,
	[EventTimestamp] [datetime2](7) NOT NULL,
	[DeviceId] [varchar](36) NOT NULL,
	[Source] [nvarchar](50) NOT NULL,
	[EventType] [nvarchar](100) NOT NULL,
	[Category] [nvarchar](50) NULL,
	[Severity] [nvarchar](20) NOT NULL,
	[RuleId] [bigint] NULL,
	[RuleName] [nvarchar](200) NULL,
	[Description] [nvarchar](max) NULL,
	[Username] [nvarchar](200) NULL,
	[SourceIp] [varchar](45) NULL,
	[DestinationIp] [varchar](45) NULL,
	[SourcePort] [int] NULL,
	[DestinationPort] [int] NULL,
	[Protocol] [nvarchar](20) NULL,
	[ProcessName] [nvarchar](260) NULL,
	[ProcessId] [int] NULL,
	[CommandLine] [nvarchar](max) NULL,
	[FilePath] [nvarchar](500) NULL,
	[FileHash] [varchar](64) NULL,
	[RegistryKey] [nvarchar](500) NULL,
	[EventProvider] [nvarchar](100) NULL,
	[MitreTactic] [varchar](20) NULL,
	[MitreTechnique] [varchar](20) NULL,
	[RawLog] [nvarchar](max) NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[WazuhOfficeServices]    Script Date: 11/4/2026 3:32:17 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[WazuhOfficeServices](
	[Id] [bigint] IDENTITY(1,1) NOT NULL,
	[DeviceId] [varchar](36) NOT NULL,
	[ServiceName] [nvarchar](500) NULL,
	[DisplayName] [nvarchar](500) NULL,
	[Status] [nvarchar](50) NULL,
	[StartupType] [nvarchar](50) NULL,
	[RunAsUser] [nvarchar](200) NULL,
	[ExecutablePath] [nvarchar](1000) NULL,
	[CapturedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[WazuhOfficeSettings]    Script Date: 11/4/2026 3:32:17 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[WazuhOfficeSettings](
	[Id] [int] NOT NULL,
	[SecurityEventRetentionDays] [int] NOT NULL,
	[AlertRetentionDays] [int] NOT NULL,
	[MetricRetentionDays] [int] NOT NULL,
	[CpuHighThresholdPercent] [float] NOT NULL,
	[MemoryHighThresholdPercent] [float] NOT NULL,
	[DiskHighThresholdPercent] [float] NOT NULL,
	[TempWarningC] [float] NOT NULL,
	[TempHighC] [float] NOT NULL,
	[TempCriticalC] [float] NOT NULL,
	[TempEmergencyC] [float] NOT NULL,
	[UpdatedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[WazuhOfficeTemperatureMetrics]    Script Date: 11/4/2026 3:32:17 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[WazuhOfficeTemperatureMetrics](
	[Id] [bigint] IDENTITY(1,1) NOT NULL,
	[DeviceId] [varchar](36) NOT NULL,
	[SensorLabel] [nvarchar](100) NULL,
	[TemperatureCelsius] [float] NOT NULL,
	[CapturedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[WazuhOfficeVulnerabilities]    Script Date: 11/4/2026 3:32:17 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[WazuhOfficeVulnerabilities](
	[Id] [bigint] IDENTITY(1,1) NOT NULL,
	[Cve] [varchar](30) NOT NULL,
	[Cvss] [float] NULL,
	[Severity] [nvarchar](20) NOT NULL,
	[AffectedPackage] [nvarchar](200) NOT NULL,
	[FixedVersion] [nvarchar](100) NULL,
	[PublishedDate] [date] NULL,
	[UpdatedDate] [date] NULL,
	[Description] [nvarchar](max) NULL,
	[References] [nvarchar](max) NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[WazuhOfficeWatchedPaths]    Script Date: 11/4/2026 3:32:17 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[WazuhOfficeWatchedPaths](
	[Id] [bigint] IDENTITY(1,1) NOT NULL,
	[DeviceId] [varchar](36) NULL,
	[PathPattern] [nvarchar](500) NOT NULL,
	[Enabled] [bit] NOT NULL,
	[CreatedByUserId] [int] NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[WebFilterLogs]    Script Date: 11/4/2026 3:32:17 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[WebFilterLogs](
	[Id] [bigint] IDENTITY(1,1) NOT NULL,
	[ReceivedAt] [datetime2](7) NOT NULL,
	[LogDate] [varchar](20) NULL,
	[LogTime] [varchar](20) NULL,
	[DeviceName] [nvarchar](100) NULL,
	[SrcIp] [varchar](45) NULL,
	[DstIp] [varchar](45) NULL,
	[SrcPort] [int] NULL,
	[DstPort] [int] NULL,
	[Protocol] [varchar](20) NULL,
	[HttpMethod] [varchar](20) NULL,
	[Url] [nvarchar](2048) NULL,
	[Domain] [nvarchar](500) NULL,
	[Category] [nvarchar](200) NULL,
	[CategoryType] [nvarchar](100) NULL,
	[Action] [nvarchar](50) NULL,
	[UserName] [nvarchar](200) NULL,
	[LogType] [nvarchar](100) NULL,
	[LogComponent] [nvarchar](100) NULL,
	[LogSubtype] [nvarchar](100) NULL,
	[RawMessage] [nvarchar](max) NULL,
	[Application] [nvarchar](200) NULL,
	[ApplicationCategory] [nvarchar](200) NULL,
	[BytesSent] [bigint] NULL,
	[BytesReceived] [bigint] NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[WebhookSettings]    Script Date: 11/4/2026 3:32:17 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[WebhookSettings](
	[Id] [int] NOT NULL,
	[Url] [nvarchar](500) NULL,
	[Platform] [varchar](20) NOT NULL,
	[Enabled] [bit] NOT NULL,
	[UpdatedAt] [datetime2](7) NOT NULL,
	[UpdatedByUserId] [int] NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[WebsiteAuditActivityLogs]    Script Date: 11/4/2026 3:32:17 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[WebsiteAuditActivityLogs](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[WebsiteId] [int] NULL,
	[ScanId] [int] NULL,
	[Action] [nvarchar](100) NOT NULL,
	[Details] [nvarchar](max) NULL,
	[ActorUserId] [int] NULL,
	[ActorName] [nvarchar](50) NOT NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[WebsiteAuditEmailLogs]    Script Date: 11/4/2026 3:32:17 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[WebsiteAuditEmailLogs](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[ScanId] [int] NOT NULL,
	[ToAddress] [nvarchar](320) NOT NULL,
	[Subject] [nvarchar](300) NOT NULL,
	[Success] [bit] NOT NULL,
	[ErrorMessage] [nvarchar](max) NULL,
	[SentAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[WebsiteAuditFindings]    Script Date: 11/4/2026 3:32:17 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[WebsiteAuditFindings](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[ScanId] [int] NOT NULL,
	[Category] [nvarchar](50) NOT NULL,
	[Severity] [nvarchar](20) NOT NULL,
	[Title] [nvarchar](300) NOT NULL,
	[Description] [nvarchar](max) NULL,
	[Evidence] [nvarchar](max) NULL,
	[Recommendation] [nvarchar](max) NULL,
	[Cvss] [float] NULL,
	[Cwe] [nvarchar](20) NULL,
	[OwaspCategory] [nvarchar](100) NULL,
	[Confidence] [nvarchar](20) NULL,
	[AffectedUrl] [nvarchar](500) NULL,
	[Parameter] [nvarchar](200) NULL,
	[HttpMethod] [nvarchar](10) NULL,
	[Module] [nvarchar](50) NULL,
	[HttpRequestSnippet] [nvarchar](max) NULL,
	[HttpResponseSnippet] [nvarchar](max) NULL,
	[AuditorNote] [nvarchar](500) NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[WebsiteAuditReports]    Script Date: 11/4/2026 3:32:17 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[WebsiteAuditReports](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[ScanId] [int] NOT NULL,
	[PdfPath] [nvarchar](500) NOT NULL,
	[GeneratedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY],
UNIQUE NONCLUSTERED 
(
	[ScanId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[WebsiteAuditScanLog]    Script Date: 11/4/2026 3:32:17 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[WebsiteAuditScanLog](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[ScanId] [int] NOT NULL,
	[Message] [nvarchar](500) NOT NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[WebsiteAuditScans]    Script Date: 11/4/2026 3:32:17 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[WebsiteAuditScans](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[WebsiteId] [int] NOT NULL,
	[ScanDate] [date] NOT NULL,
	[StartedAt] [datetime2](7) NOT NULL,
	[CompletedAt] [datetime2](7) NULL,
	[Status] [nvarchar](20) NOT NULL,
	[SecurityScore] [int] NULL,
	[RiskLevel] [nvarchar](20) NULL,
	[DetectedPlatform] [nvarchar](100) NULL,
	[TriggeredByUserId] [int] NULL,
	[TriggeredBy] [nvarchar](50) NOT NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[ScanDurationMs] [int] NULL,
	[WebsiteStatus] [nvarchar](20) NULL,
	[HostingProvider] [nvarchar](200) NULL,
	[Asn] [nvarchar](50) NULL,
	[IpAddress] [nvarchar](64) NULL,
	[Ipv6Address] [nvarchar](64) NULL,
	[ScoreHeaders] [int] NULL,
	[ScoreSsl] [int] NULL,
	[ScoreAuth] [int] NULL,
	[ScoreCookies] [int] NULL,
	[ScoreJs] [int] NULL,
	[ScoreDns] [int] NULL,
	[ScoreEmail] [int] NULL,
	[ScoreServer] [int] NULL,
	[ScoreOwasp] [int] NULL,
	[ScorePerformance] [int] NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY],
 CONSTRAINT [UQ_WebsiteAuditScans_Website_Date] UNIQUE NONCLUSTERED 
(
	[WebsiteId] ASC,
	[ScanDate] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[WebsiteAuditSourceInputs]    Script Date: 11/4/2026 3:32:17 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[WebsiteAuditSourceInputs](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[WebsiteId] [int] NOT NULL,
	[Ecosystem] [nvarchar](30) NULL,
	[LockfileFilename] [nvarchar](200) NULL,
	[LockfileContent] [nvarchar](max) NULL,
	[SourceSnippet] [nvarchar](max) NULL,
	[UpdatedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY],
UNIQUE NONCLUSTERED 
(
	[WebsiteId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[WebsiteCodeFindings]    Script Date: 11/4/2026 3:32:17 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[WebsiteCodeFindings](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[ScanId] [int] NOT NULL,
	[Category] [nvarchar](50) NOT NULL,
	[Severity] [nvarchar](20) NOT NULL,
	[Location] [nvarchar](300) NULL,
	[MaskedEvidence] [nvarchar](500) NULL,
	[Recommendation] [nvarchar](max) NULL,
	[Cvss] [float] NULL,
	[Cwe] [nvarchar](20) NULL,
	[OwaspCategory] [nvarchar](100) NULL,
	[Confidence] [nvarchar](20) NULL,
	[AffectedUrl] [nvarchar](500) NULL,
	[Parameter] [nvarchar](200) NULL,
	[HttpMethod] [nvarchar](10) NULL,
	[Module] [nvarchar](50) NULL,
	[HttpRequestSnippet] [nvarchar](max) NULL,
	[HttpResponseSnippet] [nvarchar](max) NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[WebsiteDependencyFindings]    Script Date: 11/4/2026 3:32:17 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[WebsiteDependencyFindings](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[ScanId] [int] NOT NULL,
	[PackageName] [nvarchar](200) NOT NULL,
	[CurrentVersion] [nvarchar](50) NULL,
	[RecommendedVersion] [nvarchar](50) NULL,
	[Ecosystem] [nvarchar](30) NOT NULL,
	[Severity] [nvarchar](20) NOT NULL,
	[CveIds] [nvarchar](500) NULL,
	[Reason] [nvarchar](100) NOT NULL,
	[Cvss] [float] NULL,
	[Cwe] [nvarchar](20) NULL,
	[OwaspCategory] [nvarchar](100) NULL,
	[Confidence] [nvarchar](20) NULL,
	[AffectedUrl] [nvarchar](500) NULL,
	[Parameter] [nvarchar](200) NULL,
	[HttpMethod] [nvarchar](10) NULL,
	[Module] [nvarchar](50) NULL,
	[HttpRequestSnippet] [nvarchar](max) NULL,
	[HttpResponseSnippet] [nvarchar](max) NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[WebsiteDomainStatus]    Script Date: 11/4/2026 3:32:17 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[WebsiteDomainStatus](
	[Domain] [nvarchar](255) NOT NULL,
	[SiteNames] [nvarchar](1000) NULL,
	[Registrar] [nvarchar](255) NULL,
	[ExpiresAt] [datetime2](7) NULL,
	[ErrorMessage] [nvarchar](500) NULL,
	[LastCheckedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Domain] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[WebsiteIncidentReports]    Script Date: 11/4/2026 3:32:17 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[WebsiteIncidentReports](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[MonitorId] [int] NULL,
	[WebsiteName] [nvarchar](200) NOT NULL,
	[Title] [nvarchar](500) NOT NULL,
	[IncidentCode] [nvarchar](50) NULL,
	[Severity] [varchar](20) NOT NULL,
	[StatusLabel] [nvarchar](100) NULL,
	[StatusTone] [varchar](20) NOT NULL,
	[DetectedAt] [nvarchar](200) NULL,
	[AffectedSystem] [nvarchar](300) NULL,
	[UpstreamDependency] [nvarchar](300) NULL,
	[MonitoredWindow] [nvarchar](200) NULL,
	[SummaryText] [nvarchar](max) NULL,
	[TimelineJson] [nvarchar](max) NULL,
	[MonitoringLogJson] [nvarchar](max) NULL,
	[FindingsJson] [nvarchar](max) NULL,
	[RootCauseHypothesis] [nvarchar](max) NULL,
	[RootCauseConfidence] [nvarchar](100) NULL,
	[ActionsJson] [nvarchar](max) NULL,
	[BottomLineText] [nvarchar](max) NULL,
	[PreparedFrom] [nvarchar](300) NULL,
	[ReportDate] [nvarchar](50) NULL,
	[CreatedByUserId] [int] NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[UpdatedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[WebsiteMonitorConfigs]    Script Date: 11/4/2026 3:32:17 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[WebsiteMonitorConfigs](
	[MonitorId] [int] NOT NULL,
	[Url] [nvarchar](2000) NOT NULL,
	[HttpMethod] [varchar](10) NOT NULL,
	[ExpectedStatusCode] [int] NOT NULL,
	[FollowRedirects] [bit] NOT NULL,
	[MaxRedirects] [int] NOT NULL,
	[SslVerify] [bit] NOT NULL,
	[ExpectedKeyword] [nvarchar](500) NULL,
	[ForbiddenKeyword] [nvarchar](500) NULL,
	[ResponseTimeWarningMs] [int] NOT NULL,
	[ResponseTimeCriticalMs] [int] NOT NULL,
	[AlertEmail] [nvarchar](1000) NULL,
	[MultiRegionCheckEnabled] [bit] NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[MonitorId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[WebsiteOptimizationChecks]    Script Date: 11/4/2026 3:32:17 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[WebsiteOptimizationChecks](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[ScanId] [int] NOT NULL,
	[CheckKey] [nvarchar](80) NOT NULL,
	[CheckName] [nvarchar](200) NOT NULL,
	[Status] [nvarchar](20) NOT NULL,
	[Severity] [nvarchar](20) NOT NULL,
	[CurrentValueText] [nvarchar](200) NULL,
	[RecommendedValueText] [nvarchar](200) NULL,
	[Description] [nvarchar](1000) NULL,
	[Recommendation] [nvarchar](1000) NULL,
	[EstimatedSavingsMs] [int] NULL,
	[EstimatedSavingsBytes] [bigint] NULL,
	[AffectedResourceCount] [int] NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[WebsitePerformanceAlerts]    Script Date: 11/4/2026 3:32:17 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[WebsitePerformanceAlerts](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[WebsiteId] [int] NOT NULL,
	[ScanId] [int] NULL,
	[AlertType] [nvarchar](50) NOT NULL,
	[Severity] [nvarchar](20) NOT NULL,
	[Detail] [nvarchar](500) NOT NULL,
	[TriggeredAt] [datetime2](7) NOT NULL,
	[ResolvedAt] [datetime2](7) NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[WebsitePerformanceConfigs]    Script Date: 11/4/2026 3:32:17 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[WebsitePerformanceConfigs](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[WebsiteId] [int] NOT NULL,
	[Enabled] [bit] NOT NULL,
	[TestDevice] [nvarchar](20) NOT NULL,
	[ScheduleType] [nvarchar](20) NOT NULL,
	[CustomCron] [nvarchar](100) NULL,
	[TimeoutSeconds] [int] NOT NULL,
	[ScreenshotCapture] [bit] NOT NULL,
	[ScoreThreshold] [int] NULL,
	[LcpThresholdMs] [int] NULL,
	[ClsThreshold] [float] NULL,
	[TbtThresholdMs] [int] NULL,
	[PageSizeThresholdKb] [int] NULL,
	[RequestCountThreshold] [int] NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[UpdatedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY],
 CONSTRAINT [UQ_WebsitePerformanceConfigs_WebsiteId] UNIQUE NONCLUSTERED 
(
	[WebsiteId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[WebsitePerformanceReports]    Script Date: 11/4/2026 3:32:17 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[WebsitePerformanceReports](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[WebsiteId] [int] NOT NULL,
	[ScanId] [int] NULL,
	[Format] [nvarchar](10) NOT NULL,
	[FilePath] [nvarchar](500) NULL,
	[GeneratedByUserId] [int] NULL,
	[GeneratedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[WebsitePerformanceResourceMetrics]    Script Date: 11/4/2026 3:32:17 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[WebsitePerformanceResourceMetrics](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[ScanId] [int] NOT NULL,
	[TotalRequests] [int] NULL,
	[TotalTransferredBytes] [bigint] NULL,
	[TotalUncompressedBytes] [bigint] NULL,
	[HtmlCount] [int] NULL,
	[HtmlBytes] [bigint] NULL,
	[CssCount] [int] NULL,
	[CssBytes] [bigint] NULL,
	[JsCount] [int] NULL,
	[JsBytes] [bigint] NULL,
	[ImageCount] [int] NULL,
	[ImageBytes] [bigint] NULL,
	[FontCount] [int] NULL,
	[FontBytes] [bigint] NULL,
	[MediaCount] [int] NULL,
	[MediaBytes] [bigint] NULL,
	[ThirdPartyCount] [int] NULL,
	[ThirdPartyBytes] [bigint] NULL,
	[CachedCount] [int] NULL,
	[FailedCount] [int] NULL,
	[RedirectedCount] [int] NULL,
	[RenderBlockingCount] [int] NULL,
	[UnusedCssBytesEst] [bigint] NULL,
	[UnusedJsBytesEst] [bigint] NULL,
	[UnoptimizedImageCount] [int] NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY],
 CONSTRAINT [UQ_WebsitePerformanceResourceMetrics_ScanId] UNIQUE NONCLUSTERED 
(
	[ScanId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[WebsitePerformanceScans]    Script Date: 11/4/2026 3:32:17 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[WebsitePerformanceScans](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[WebsiteId] [int] NOT NULL,
	[Device] [nvarchar](10) NOT NULL,
	[Status] [nvarchar](20) NOT NULL,
	[TriggeredBy] [nvarchar](20) NOT NULL,
	[TriggeredByUserId] [int] NULL,
	[StartedAt] [datetime2](7) NULL,
	[CompletedAt] [datetime2](7) NULL,
	[ErrorMessage] [nvarchar](1000) NULL,
	[FinalUrl] [nvarchar](500) NULL,
	[HttpStatusCode] [int] NULL,
	[RedirectCount] [int] NULL,
	[ResponseSizeBytes] [bigint] NULL,
	[HttpProtocol] [nvarchar](10) NULL,
	[ServerIp] [nvarchar](45) NULL,
	[DnsLookupMs] [int] NULL,
	[TcpConnectMs] [int] NULL,
	[TlsHandshakeMs] [int] NULL,
	[ContentDownloadMs] [int] NULL,
	[TotalResponseTimeMs] [int] NULL,
	[TtfbMs] [int] NULL,
	[FirstContentfulPaintMs] [int] NULL,
	[LargestContentfulPaintMs] [int] NULL,
	[CumulativeLayoutShift] [float] NULL,
	[TotalBlockingTimeMs] [int] NULL,
	[SpeedIndexMs] [int] NULL,
	[TimeToInteractiveMs] [int] NULL,
	[InteractionToNextPaintMs] [int] NULL,
	[DomContentLoadedMs] [int] NULL,
	[FullyLoadedMs] [int] NULL,
	[FirstPaintMs] [int] NULL,
	[OverallScore] [int] NULL,
	[CoreWebVitalsScore] [int] NULL,
	[ServerResponseScore] [int] NULL,
	[ResourceOptimizationScore] [int] NULL,
	[UserExperienceScore] [int] NULL,
	[ScreenshotPath] [nvarchar](500) NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Websites]    Script Date: 11/4/2026 3:32:17 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Websites](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[Name] [nvarchar](200) NOT NULL,
	[Url] [nvarchar](500) NOT NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[Enabled] [bit] NOT NULL,
	[Environment] [nvarchar](20) NOT NULL,
	[PhpVersion] [nvarchar](50) NULL,
	[PhpVersionCheckedAt] [datetime2](7) NULL,
	[PhpVersionScanError] [nvarchar](200) NULL,
	[Platform] [nvarchar](50) NULL,
	[PlatformVersion] [nvarchar](100) NULL,
	[ServerHeader] [nvarchar](150) NULL,
	[PhpVersionManual] [bit] NOT NULL,
	[PlatformVersionManual] [bit] NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[WebsiteScanSchedules]    Script Date: 11/4/2026 3:32:17 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[WebsiteScanSchedules](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[WebsiteId] [int] NOT NULL,
	[ScheduleType] [nvarchar](20) NOT NULL,
	[TimesPerDay] [int] NOT NULL,
	[ScanTimes] [nvarchar](100) NOT NULL,
	[RepeatIntervalDays] [int] NULL,
	[DayOfWeek] [int] NULL,
	[DayOfMonth] [int] NULL,
	[MonthOfYear] [int] NULL,
	[LastRunAt] [datetime2](7) NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[UpdatedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY],
 CONSTRAINT [UQ_WebsiteScanSchedules_WebsiteId] UNIQUE NONCLUSTERED 
(
	[WebsiteId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[WebsiteSslStatus]    Script Date: 11/4/2026 3:32:17 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[WebsiteSslStatus](
	[WebsiteId] [int] NOT NULL,
	[ExpiresAt] [datetime2](7) NULL,
	[ErrorMessage] [nvarchar](500) NULL,
	[LastCheckedAt] [datetime2](7) NOT NULL,
	[Issuer] [nvarchar](200) NULL,
	[Subject] [nvarchar](200) NULL,
	[ValidFrom] [datetime2](7) NULL,
	[HostnameMatch] [bit] NULL,
	[ChainValid] [bit] NULL,
	[SelfSigned] [bit] NULL,
	[TlsProtocol] [varchar](20) NULL,
PRIMARY KEY CLUSTERED 
(
	[WebsiteId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[WifiAccessPointStatus]    Script Date: 11/4/2026 3:32:17 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[WifiAccessPointStatus](
	[Id] [int] NOT NULL,
	[EnforcementMode] [varchar](20) NOT NULL,
	[LastSyncAttemptAt] [datetime2](7) NULL,
	[LastSyncSuccessAt] [datetime2](7) NULL,
	[LastSyncError] [nvarchar](1000) NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[WifiAllowedDevices]    Script Date: 11/4/2026 3:32:17 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[WifiAllowedDevices](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[MacAddress] [varchar](17) NOT NULL,
	[Label] [nvarchar](200) NULL,
	[StaffId] [int] NULL,
	[Source] [varchar](20) NOT NULL,
	[AddedByUserId] [int] NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[UpdatedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY],
 CONSTRAINT [UQ_WifiAllowedDevices_MacAddress] UNIQUE NONCLUSTERED 
(
	[MacAddress] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[WordPressDeepScans]    Script Date: 11/4/2026 3:32:17 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[WordPressDeepScans](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[WebsiteId] [int] NULL,
	[TargetUrl] [nvarchar](1000) NOT NULL,
	[IsWordPress] [bit] NOT NULL,
	[CoreVersion] [nvarchar](50) NULL,
	[ThemeSlug] [nvarchar](200) NULL,
	[ThemeVersion] [nvarchar](50) NULL,
	[RiskLevel] [varchar](20) NOT NULL,
	[FindingsJson] [nvarchar](max) NOT NULL,
	[ChecksJson] [nvarchar](max) NOT NULL,
	[PluginsJson] [nvarchar](max) NOT NULL,
	[TriggeredByUserId] [int] NULL,
	[TriggeredByUsername] [nvarchar](100) NULL,
	[ScannedAt] [datetime2](7) NOT NULL,
	[PhpVersion] [nvarchar](50) NULL,
	[LatestCoreVersion] [nvarchar](50) NULL,
	[Profile] [varchar](20) NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[WordPressFindings]    Script Date: 11/4/2026 3:32:17 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[WordPressFindings](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[WebsiteId] [int] NOT NULL,
	[FindingKey] [varchar](64) NOT NULL,
	[CheckId] [varchar](40) NOT NULL,
	[Severity] [varchar](20) NOT NULL,
	[Title] [nvarchar](500) NOT NULL,
	[Detail] [nvarchar](max) NULL,
	[Evidence] [nvarchar](max) NULL,
	[Status] [varchar](20) NOT NULL,
	[FirstSeenScanId] [int] NOT NULL,
	[LastSeenScanId] [int] NOT NULL,
	[FirstSeenAt] [datetime2](7) NOT NULL,
	[LastSeenAt] [datetime2](7) NOT NULL,
	[ResolvedAt] [datetime2](7) NULL,
	[AuditorNote] [nvarchar](500) NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY],
 CONSTRAINT [UQ_WordPressFindings_Website_Key] UNIQUE NONCLUSTERED 
(
	[WebsiteId] ASC,
	[FindingKey] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[WordPressFindingStatusHistory]    Script Date: 11/4/2026 3:32:17 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[WordPressFindingStatusHistory](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[FindingId] [int] NOT NULL,
	[OldStatus] [varchar](20) NULL,
	[NewStatus] [varchar](20) NOT NULL,
	[ChangedByUserId] [int] NULL,
	[ChangedByUsername] [nvarchar](100) NULL,
	[Reason] [nvarchar](500) NULL,
	[ChangedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[WordPressScanSchedules]    Script Date: 11/4/2026 3:32:17 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[WordPressScanSchedules](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[WebsiteId] [int] NOT NULL,
	[Recurrence] [varchar](20) NOT NULL,
	[Profile] [varchar](20) NOT NULL,
	[NextRunAt] [datetime2](7) NOT NULL,
	[LastRunAt] [datetime2](7) NULL,
	[IsActive] [bit] NOT NULL,
	[CreatedByUserId] [int] NULL,
	[CreatedByUsername] [nvarchar](100) NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY],
 CONSTRAINT [UQ_WordPressScanSchedules_Website] UNIQUE NONCLUSTERED 
(
	[WebsiteId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Index [IX_AdminAuditLog_CreatedAt]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_AdminAuditLog_CreatedAt] ON [dbo].[AdminAuditLog]
(
	[CreatedAt] DESC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [UX_AdSyncedComputers_SamAccountName]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE UNIQUE NONCLUSTERED INDEX [UX_AdSyncedComputers_SamAccountName] ON [dbo].[AdSyncedComputers]
(
	[SamAccountName] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, IGNORE_DUP_KEY = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [UX_AdSyncedUsers_AdObjectGuid]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE UNIQUE NONCLUSTERED INDEX [UX_AdSyncedUsers_AdObjectGuid] ON [dbo].[AdSyncedUsers]
(
	[AdObjectGuid] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, IGNORE_DUP_KEY = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_AlertEscalationSteps_PolicyId_Order]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_AlertEscalationSteps_PolicyId_Order] ON [dbo].[AlertEscalationSteps]
(
	[AlertPolicyId] ASC,
	[StepOrder] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [UX_AppCategories_Name]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [UX_AppCategories_Name] ON [dbo].[AppCategories]
(
	[Name] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_AppCategoryRules_ProcessName]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_AppCategoryRules_ProcessName] ON [dbo].[AppCategoryRules]
(
	[ProcessName] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_AppUsageSessions_CategoryId]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_AppUsageSessions_CategoryId] ON [dbo].[AppUsageSessions]
(
	[CategoryId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_AppUsageSessions_Device_Open]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_AppUsageSessions_Device_Open] ON [dbo].[AppUsageSessions]
(
	[DeviceId] ASC,
	[ProcessName] ASC
)
WHERE ([EndedAt] IS NULL)
WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_AppUsageSessions_Device_Started]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_AppUsageSessions_Device_Started] ON [dbo].[AppUsageSessions]
(
	[DeviceId] ASC,
	[StartedAt] DESC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_AppUsageSessions_ReceivedAt]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_AppUsageSessions_ReceivedAt] ON [dbo].[AppUsageSessions]
(
	[ReceivedAt] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_AppUsageSessions_Staff_Started]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_AppUsageSessions_Staff_Started] ON [dbo].[AppUsageSessions]
(
	[StaffId] ASC,
	[StartedAt] DESC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_AssetAttachments_AssetId]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_AssetAttachments_AssetId] ON [dbo].[AssetAttachments]
(
	[AssetId] ASC
)
WHERE ([IsDeleted]=(0))
WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_Assets_AssignedUser]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_Assets_AssignedUser] ON [dbo].[Assets]
(
	[AssignedUser] ASC
)
WHERE ([IsDeleted]=(0))
WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_Assets_Department]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_Assets_Department] ON [dbo].[Assets]
(
	[Department] ASC
)
WHERE ([IsDeleted]=(0))
WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_Assets_Hostname]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_Assets_Hostname] ON [dbo].[Assets]
(
	[Hostname] ASC
)
WHERE ([IsDeleted]=(0))
WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_Assets_IpAddress]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_Assets_IpAddress] ON [dbo].[Assets]
(
	[IpAddress] ASC
)
WHERE ([IsDeleted]=(0))
WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_Assets_SerialNumber]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_Assets_SerialNumber] ON [dbo].[Assets]
(
	[SerialNumber] ASC
)
WHERE ([IsDeleted]=(0))
WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_Assets_Status]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_Assets_Status] ON [dbo].[Assets]
(
	[Status] ASC
)
WHERE ([IsDeleted]=(0))
WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_AutomationJobTargets_DeviceId_Pending]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_AutomationJobTargets_DeviceId_Pending] ON [dbo].[AutomationJobTargets]
(
	[DeviceId] ASC
)
WHERE ([Status]='Pending')
WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_AutomationJobTargets_JobId]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_AutomationJobTargets_JobId] ON [dbo].[AutomationJobTargets]
(
	[JobId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_AutomationSchedules_Due]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_AutomationSchedules_Due] ON [dbo].[AutomationSchedules]
(
	[NextRunAt] ASC
)
WHERE ([IsActive]=(1) AND [IsDeleted]=(0))
WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_BackupHistory_CreatedAt]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_BackupHistory_CreatedAt] ON [dbo].[BackupHistory]
(
	[CreatedAt] DESC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [UX_BrowserActivityEngagementAlerts_Staff_Domain_Date]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE UNIQUE NONCLUSTERED INDEX [UX_BrowserActivityEngagementAlerts_Staff_Domain_Date] ON [dbo].[BrowserActivityEngagementAlerts]
(
	[StaffId] ASC,
	[Domain] ASC,
	[AlertDate] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, IGNORE_DUP_KEY = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_BrowserActivityEvents_DeviceId_VisitedAt]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_BrowserActivityEvents_DeviceId_VisitedAt] ON [dbo].[BrowserActivityEvents]
(
	[DeviceId] ASC,
	[VisitedAt] DESC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_BrowserActivityEvents_Domain]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_BrowserActivityEvents_Domain] ON [dbo].[BrowserActivityEvents]
(
	[Domain] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_BrowserActivityEvents_ReceivedAt]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_BrowserActivityEvents_ReceivedAt] ON [dbo].[BrowserActivityEvents]
(
	[ReceivedAt] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_BrowserActivityEvents_SecurityEvent]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_BrowserActivityEvents_SecurityEvent] ON [dbo].[BrowserActivityEvents]
(
	[IsSecurityEvent] ASC,
	[VisitedAt] DESC
)
WHERE ([IsSecurityEvent]=(1))
WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_BrowserActivityEvents_StaffId_VisitedAt]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_BrowserActivityEvents_StaffId_VisitedAt] ON [dbo].[BrowserActivityEvents]
(
	[StaffId] ASC,
	[VisitedAt] DESC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_ChatMessages_Staff_CreatedAt]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_ChatMessages_Staff_CreatedAt] ON [dbo].[ChatMessages]
(
	[StaffId] ASC,
	[CreatedAt] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_CodeQualityGitHubConnections_DeletedAt]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_CodeQualityGitHubConnections_DeletedAt] ON [dbo].[CodeQualityGitHubConnections]
(
	[DeletedAt] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_CodeQualityGitLabConnections_DeletedAt]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_CodeQualityGitLabConnections_DeletedAt] ON [dbo].[CodeQualityGitLabConnections]
(
	[DeletedAt] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_CodeQualityIssues_Category]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_CodeQualityIssues_Category] ON [dbo].[CodeQualityIssues]
(
	[Category] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_CodeQualityIssues_ProjectId]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_CodeQualityIssues_ProjectId] ON [dbo].[CodeQualityIssues]
(
	[ProjectId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_CodeQualityIssues_ScanId]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_CodeQualityIssues_ScanId] ON [dbo].[CodeQualityIssues]
(
	[ScanId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_CodeQualityIssues_Severity]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_CodeQualityIssues_Severity] ON [dbo].[CodeQualityIssues]
(
	[Severity] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_CodeQualityIssues_Status]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_CodeQualityIssues_Status] ON [dbo].[CodeQualityIssues]
(
	[Status] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_CodeQualityMetrics_ScanId]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_CodeQualityMetrics_ScanId] ON [dbo].[CodeQualityMetrics]
(
	[ScanId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_CodeQualityMetrics_ScanId_MetricType]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_CodeQualityMetrics_ScanId_MetricType] ON [dbo].[CodeQualityMetrics]
(
	[ScanId] ASC,
	[MetricType] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_CodeQualityScanLog_ScanId]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_CodeQualityScanLog_ScanId] ON [dbo].[CodeQualityScanLog]
(
	[ScanId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_CodeQualityScans_CreatedAt]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_CodeQualityScans_CreatedAt] ON [dbo].[CodeQualityScans]
(
	[CreatedAt] DESC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_CodeQualityScans_ProjectId]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_CodeQualityScans_ProjectId] ON [dbo].[CodeQualityScans]
(
	[ProjectId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_CodeQualityScans_Status]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_CodeQualityScans_Status] ON [dbo].[CodeQualityScans]
(
	[Status] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_ComplianceControlEvidence_ControlId]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_ComplianceControlEvidence_ControlId] ON [dbo].[ComplianceControlEvidence]
(
	[ControlId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_ComplianceControls_FrameworkId]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_ComplianceControls_FrameworkId] ON [dbo].[ComplianceControls]
(
	[FrameworkId] ASC,
	[SortOrder] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_DashboardLayouts_UserId]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_DashboardLayouts_UserId] ON [dbo].[DashboardLayouts]
(
	[UserId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_DeviceAlerts_DeviceId_TriggeredAt]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_DeviceAlerts_DeviceId_TriggeredAt] ON [dbo].[DeviceAlerts]
(
	[DeviceId] ASC,
	[TriggeredAt] DESC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_DeviceAlerts_Unresolved]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_DeviceAlerts_Unresolved] ON [dbo].[DeviceAlerts]
(
	[DeviceId] ASC,
	[AlertType] ASC
)
WHERE ([ResolvedAt] IS NULL)
WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_DeviceDisks_DeviceId]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_DeviceDisks_DeviceId] ON [dbo].[DeviceDisks]
(
	[DeviceId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_DeviceLocalUsers_DeviceId]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_DeviceLocalUsers_DeviceId] ON [dbo].[DeviceLocalUsers]
(
	[DeviceId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_DeviceMetrics_DeviceId_ReceivedAt]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_DeviceMetrics_DeviceId_ReceivedAt] ON [dbo].[DeviceMetrics]
(
	[DeviceId] ASC,
	[ReceivedAt] DESC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_DeviceNetworkInterfaces_DeviceId]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_DeviceNetworkInterfaces_DeviceId] ON [dbo].[DeviceNetworkInterfaces]
(
	[DeviceId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [UQ_Devices_ChatToken]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE UNIQUE NONCLUSTERED INDEX [UQ_Devices_ChatToken] ON [dbo].[Devices]
(
	[ChatToken] ASC
)
WHERE ([ChatToken] IS NOT NULL)
WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, IGNORE_DUP_KEY = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_DeviceUpdates_Status]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_DeviceUpdates_Status] ON [dbo].[DeviceUpdates]
(
	[Status] ASC,
	[Category] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [UX_DeviceUpdates_DeviceKey]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE UNIQUE NONCLUSTERED INDEX [UX_DeviceUpdates_DeviceKey] ON [dbo].[DeviceUpdates]
(
	[DeviceId] ASC,
	[UpdateKey] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, IGNORE_DUP_KEY = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_DeviceUpdateScans_Device]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_DeviceUpdateScans_Device] ON [dbo].[DeviceUpdateScans]
(
	[DeviceId] ASC,
	[ScannedAt] DESC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_DeviceUsbEvents_DeviceId_DetectedAt]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_DeviceUsbEvents_DeviceId_DetectedAt] ON [dbo].[DeviceUsbEvents]
(
	[DeviceId] ASC,
	[DetectedAt] DESC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_DeviceVolumes_DeviceId]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_DeviceVolumes_DeviceId] ON [dbo].[DeviceVolumes]
(
	[DeviceId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [UX_DomainCategories_Name]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE UNIQUE NONCLUSTERED INDEX [UX_DomainCategories_Name] ON [dbo].[DomainCategories]
(
	[Name] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, IGNORE_DUP_KEY = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [UX_DomainCategoryRules_Domain]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE UNIQUE NONCLUSTERED INDEX [UX_DomainCategoryRules_Domain] ON [dbo].[DomainCategoryRules]
(
	[Domain] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, IGNORE_DUP_KEY = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_EmailDeliveryLog_CreatedAt]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_EmailDeliveryLog_CreatedAt] ON [dbo].[EmailDeliveryLog]
(
	[CreatedAt] DESC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_EmailSecurityScans_Domain]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_EmailSecurityScans_Domain] ON [dbo].[EmailSecurityScans]
(
	[Domain] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_EmailSecurityScans_ScannedAt]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_EmailSecurityScans_ScannedAt] ON [dbo].[EmailSecurityScans]
(
	[ScannedAt] DESC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_EmailSecurityScans_WebsiteId]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_EmailSecurityScans_WebsiteId] ON [dbo].[EmailSecurityScans]
(
	[WebsiteId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_EmployeeNotifications_StaffId]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_EmployeeNotifications_StaffId] ON [dbo].[EmployeeNotifications]
(
	[StaffId] ASC,
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [UX_ExcludedDomains_Domain]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE UNIQUE NONCLUSTERED INDEX [UX_ExcludedDomains_Domain] ON [dbo].[ExcludedDomains]
(
	[Domain] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, IGNORE_DUP_KEY = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_FileIntegrityEvents_DeviceId_DetectedAt]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_FileIntegrityEvents_DeviceId_DetectedAt] ON [dbo].[FileIntegrityEvents]
(
	[DeviceId] ASC,
	[DetectedAt] DESC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_HelpArticleFeedback_ArticleId]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_HelpArticleFeedback_ArticleId] ON [dbo].[HelpArticleFeedback]
(
	[ArticleId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_HelpArticles_CategoryKey]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_HelpArticles_CategoryKey] ON [dbo].[HelpArticles]
(
	[CategoryKey] ASC,
	[GroupKey] ASC,
	[ItemKey] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_HelpArticles_Status]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_HelpArticles_Status] ON [dbo].[HelpArticles]
(
	[Status] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_HelpArticles_Type]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_HelpArticles_Type] ON [dbo].[HelpArticles]
(
	[Type] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [UQ_HelpArticles_Slug]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE UNIQUE NONCLUSTERED INDEX [UQ_HelpArticles_Slug] ON [dbo].[HelpArticles]
(
	[Slug] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, IGNORE_DUP_KEY = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_IisAppPools_DeviceId]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_IisAppPools_DeviceId] ON [dbo].[IisAppPools]
(
	[DeviceId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_IisPerfSnapshots_DeviceId_ReceivedAt]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_IisPerfSnapshots_DeviceId_ReceivedAt] ON [dbo].[IisPerfSnapshots]
(
	[DeviceId] ASC,
	[ReceivedAt] DESC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_IisSites_DeviceId]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_IisSites_DeviceId] ON [dbo].[IisSites]
(
	[DeviceId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_IisWorkerProcesses_DeviceId]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_IisWorkerProcesses_DeviceId] ON [dbo].[IisWorkerProcesses]
(
	[DeviceId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_InAppNotifications_UserId_IsRead_CreatedAt]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_InAppNotifications_UserId_IsRead_CreatedAt] ON [dbo].[InAppNotifications]
(
	[UserId] ASC,
	[IsRead] ASC,
	[CreatedAt] DESC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_Incidents_MonitorId_Status]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_Incidents_MonitorId_Status] ON [dbo].[Incidents]
(
	[MonitorId] ASC,
	[Status] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_IncidentTimeline_Incident]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_IncidentTimeline_Incident] ON [dbo].[IncidentTimeline]
(
	[IncidentId] ASC,
	[CreatedAt] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_ItAssetNotifications_IsRead]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_ItAssetNotifications_IsRead] ON [dbo].[ItAssetNotifications]
(
	[IsRead] ASC,
	[CreatedAt] DESC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_KnowledgeBaseDocuments_Category]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_KnowledgeBaseDocuments_Category] ON [dbo].[KnowledgeBaseDocuments]
(
	[Category] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_KnowledgeBaseDocuments_CreatedAt]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_KnowledgeBaseDocuments_CreatedAt] ON [dbo].[KnowledgeBaseDocuments]
(
	[CreatedAt] DESC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_LaravelSecurityIssues_Category]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_LaravelSecurityIssues_Category] ON [dbo].[LaravelSecurityIssues]
(
	[Category] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_LaravelSecurityIssues_ProjectId]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_LaravelSecurityIssues_ProjectId] ON [dbo].[LaravelSecurityIssues]
(
	[ProjectId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_LaravelSecurityIssues_ScanId]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_LaravelSecurityIssues_ScanId] ON [dbo].[LaravelSecurityIssues]
(
	[ScanId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_LaravelSecurityIssues_Severity]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_LaravelSecurityIssues_Severity] ON [dbo].[LaravelSecurityIssues]
(
	[Severity] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_LaravelSecurityIssues_Status]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_LaravelSecurityIssues_Status] ON [dbo].[LaravelSecurityIssues]
(
	[Status] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_LaravelSecurityProjects_RepoConnectionId]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_LaravelSecurityProjects_RepoConnectionId] ON [dbo].[LaravelSecurityProjects]
(
	[RepoConnectionId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_LaravelSecurityScanLog_ScanId]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_LaravelSecurityScanLog_ScanId] ON [dbo].[LaravelSecurityScanLog]
(
	[ScanId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_LaravelSecurityScans_CreatedAt]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_LaravelSecurityScans_CreatedAt] ON [dbo].[LaravelSecurityScans]
(
	[CreatedAt] DESC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_LaravelSecurityScans_ProjectId]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_LaravelSecurityScans_ProjectId] ON [dbo].[LaravelSecurityScans]
(
	[ProjectId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_LaravelSecurityScans_Status]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_LaravelSecurityScans_Status] ON [dbo].[LaravelSecurityScans]
(
	[Status] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_LinuxFail2banJails_DeviceId]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_LinuxFail2banJails_DeviceId] ON [dbo].[LinuxFail2banJails]
(
	[DeviceId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_LinuxOpenPorts_DeviceId]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_LinuxOpenPorts_DeviceId] ON [dbo].[LinuxOpenPorts]
(
	[DeviceId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_LinuxPermissionFindings_DeviceId]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_LinuxPermissionFindings_DeviceId] ON [dbo].[LinuxPermissionFindings]
(
	[DeviceId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_LinuxSudoNopasswdEntries_DeviceId]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_LinuxSudoNopasswdEntries_DeviceId] ON [dbo].[LinuxSudoNopasswdEntries]
(
	[DeviceId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_LoginActivity_CreatedAt]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_LoginActivity_CreatedAt] ON [dbo].[LoginActivity]
(
	[CreatedAt] DESC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_MailBlockingPolicies_Enabled]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_MailBlockingPolicies_Enabled] ON [dbo].[MailBlockingPolicies]
(
	[Enabled] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_MailIncidentAttachments_IncidentId]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_MailIncidentAttachments_IncidentId] ON [dbo].[MailIncidentAttachments]
(
	[IncidentId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_MailIncidentUrls_IncidentId]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_MailIncidentUrls_IncidentId] ON [dbo].[MailIncidentUrls]
(
	[IncidentId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_MailPolicyExceptions_PolicyId]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_MailPolicyExceptions_PolicyId] ON [dbo].[MailPolicyExceptions]
(
	[PolicyId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_MailPolicyScopes_PolicyId]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_MailPolicyScopes_PolicyId] ON [dbo].[MailPolicyScopes]
(
	[PolicyId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_MailSecurityIncidents_DetectedAt]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_MailSecurityIncidents_DetectedAt] ON [dbo].[MailSecurityIncidents]
(
	[DetectedAt] DESC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_MailSecurityIncidents_MatchedPolicyId]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_MailSecurityIncidents_MatchedPolicyId] ON [dbo].[MailSecurityIncidents]
(
	[MatchedPolicyId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_MaintenanceLogs_AssetId]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_MaintenanceLogs_AssetId] ON [dbo].[MaintenanceLogs]
(
	[AssetId] ASC
)
WHERE ([IsDeleted]=(0))
WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_MaintenanceLogs_ScheduledDate]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_MaintenanceLogs_ScheduledDate] ON [dbo].[MaintenanceLogs]
(
	[ScheduledDate] ASC
)
WHERE ([IsDeleted]=(0))
WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_MaintenanceLogs_Status]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_MaintenanceLogs_Status] ON [dbo].[MaintenanceLogs]
(
	[Status] ASC
)
WHERE ([IsDeleted]=(0))
WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_MaintenanceWindows_Active_Window]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_MaintenanceWindows_Active_Window] ON [dbo].[MaintenanceWindows]
(
	[IsActive] ASC,
	[StartsAt] ASC,
	[EndsAt] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_MalwareFindings_CheckType]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_MalwareFindings_CheckType] ON [dbo].[MalwareFindings]
(
	[CheckType] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_MalwareFindings_DeviceId]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_MalwareFindings_DeviceId] ON [dbo].[MalwareFindings]
(
	[DeviceId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_MalwareFindings_DeviceId_FilePath_CheckType]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_MalwareFindings_DeviceId_FilePath_CheckType] ON [dbo].[MalwareFindings]
(
	[DeviceId] ASC,
	[FilePath] ASC,
	[CheckType] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_MalwareFindings_ScanId]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_MalwareFindings_ScanId] ON [dbo].[MalwareFindings]
(
	[ScanId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_MalwareFindings_Status]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_MalwareFindings_Status] ON [dbo].[MalwareFindings]
(
	[Status] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_MalwareFindings_WebsiteId]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_MalwareFindings_WebsiteId] ON [dbo].[MalwareFindings]
(
	[WebsiteId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_MalwareScans_CreatedAt]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_MalwareScans_CreatedAt] ON [dbo].[MalwareScans]
(
	[CreatedAt] DESC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_MalwareScans_DeviceId]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_MalwareScans_DeviceId] ON [dbo].[MalwareScans]
(
	[DeviceId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_MalwareScans_WebsiteId]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_MalwareScans_WebsiteId] ON [dbo].[MalwareScans]
(
	[WebsiteId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_MonitorResults_MonitorId_CheckedAt]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_MonitorResults_MonitorId_CheckedAt] ON [dbo].[MonitorResults]
(
	[MonitorId] ASC,
	[CheckedAt] DESC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_Monitors_NextCheckAt]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_Monitors_NextCheckAt] ON [dbo].[Monitors]
(
	[MonitorType] ASC,
	[IsActive] ASC,
	[NextCheckAt] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_NetworkDiagramDesigns_OwnerUserId]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_NetworkDiagramDesigns_OwnerUserId] ON [dbo].[NetworkDiagramDesigns]
(
	[OwnerUserId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_NetworkDiagramDesigns_Status]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_NetworkDiagramDesigns_Status] ON [dbo].[NetworkDiagramDesigns]
(
	[Status] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_NotificationLogs_CreatedAt]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_NotificationLogs_CreatedAt] ON [dbo].[NotificationLogs]
(
	[CreatedAt] DESC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_NvrCameras_NvrId]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_NvrCameras_NvrId] ON [dbo].[NvrCameras]
(
	[NvrId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_OffboardingActions_StaffId]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_OffboardingActions_StaffId] ON [dbo].[OffboardingActions]
(
	[StaffId] ASC,
	[CreatedAt] DESC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_OpsAuditLog_CreatedAt]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_OpsAuditLog_CreatedAt] ON [dbo].[OpsAuditLog]
(
	[CreatedAt] DESC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_OpsAuditLog_Incident]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_OpsAuditLog_Incident] ON [dbo].[OpsAuditLog]
(
	[IncidentNumber] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_PasswordChangeLogs_AssetId]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_PasswordChangeLogs_AssetId] ON [dbo].[PasswordChangeLogs]
(
	[AssetId] ASC
)
WHERE ([IsDeleted]=(0))
WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_PasswordChangeLogs_NextPasswordChangeDate]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_PasswordChangeLogs_NextPasswordChangeDate] ON [dbo].[PasswordChangeLogs]
(
	[NextPasswordChangeDate] ASC
)
WHERE ([IsDeleted]=(0))
WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_PasswordChangeLogs_Status]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_PasswordChangeLogs_Status] ON [dbo].[PasswordChangeLogs]
(
	[Status] ASC
)
WHERE ([IsDeleted]=(0))
WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_PatchUpdateLogs_AssetId]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_PatchUpdateLogs_AssetId] ON [dbo].[PatchUpdateLogs]
(
	[AssetId] ASC
)
WHERE ([IsDeleted]=(0))
WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_PatchUpdateLogs_InstallationStatus]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_PatchUpdateLogs_InstallationStatus] ON [dbo].[PatchUpdateLogs]
(
	[InstallationStatus] ASC
)
WHERE ([IsDeleted]=(0))
WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_PatchUpdateLogs_ScheduledInstallationDate]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_PatchUpdateLogs_ScheduledInstallationDate] ON [dbo].[PatchUpdateLogs]
(
	[ScheduledInstallationDate] ASC
)
WHERE ([IsDeleted]=(0))
WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_PatchUpdateLogs_Severity]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_PatchUpdateLogs_Severity] ON [dbo].[PatchUpdateLogs]
(
	[Severity] ASC
)
WHERE ([IsDeleted]=(0))
WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_PendingMalwareScanRequests_DeviceId_Unfulfilled]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_PendingMalwareScanRequests_DeviceId_Unfulfilled] ON [dbo].[PendingMalwareScanRequests]
(
	[DeviceId] ASC
)
WHERE ([FulfilledAt] IS NULL)
WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_PendingPhpLogRequests_DeviceId_Unfulfilled]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_PendingPhpLogRequests_DeviceId_Unfulfilled] ON [dbo].[PendingPhpLogRequests]
(
	[DeviceId] ASC
)
WHERE ([FulfilledAt] IS NULL)
WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_PendingUpdateRequests_Device]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_PendingUpdateRequests_Device] ON [dbo].[PendingUpdateRequests]
(
	[DeviceId] ASC,
	[FulfilledAt] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_PendingUpdateRequests_Kind]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_PendingUpdateRequests_Kind] ON [dbo].[PendingUpdateRequests]
(
	[Kind] ASC,
	[DeviceId] ASC,
	[FulfilledAt] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_PendingWakeRequests_Relay]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_PendingWakeRequests_Relay] ON [dbo].[PendingWakeRequests]
(
	[RelayDeviceId] ASC,
	[FulfilledAt] ASC
)
INCLUDE ( 	[ExpiresAt],
	[TargetMac]) WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_PhpVersions_DeviceId]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_PhpVersions_DeviceId] ON [dbo].[PhpVersions]
(
	[DeviceId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_QaActivityLogs_CreatedAt]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_QaActivityLogs_CreatedAt] ON [dbo].[QaActivityLogs]
(
	[CreatedAt] DESC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_QaActivityLogs_Entity]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_QaActivityLogs_Entity] ON [dbo].[QaActivityLogs]
(
	[EntityType] ASC,
	[EntityId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_QaAttachments_Entity]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_QaAttachments_Entity] ON [dbo].[QaAttachments]
(
	[EntityType] ASC,
	[EntityId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_QaBugs_AssignedDeveloperUserId]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_QaBugs_AssignedDeveloperUserId] ON [dbo].[QaBugs]
(
	[AssignedDeveloperUserId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_QaBugs_ProjectId]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_QaBugs_ProjectId] ON [dbo].[QaBugs]
(
	[ProjectId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_QaBugs_Status]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_QaBugs_Status] ON [dbo].[QaBugs]
(
	[Status] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_QaBuilds_ProjectId]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_QaBuilds_ProjectId] ON [dbo].[QaBuilds]
(
	[ProjectId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_QaComments_Entity]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_QaComments_Entity] ON [dbo].[QaComments]
(
	[EntityType] ASC,
	[EntityId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_QaEnvironments_ProjectId]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_QaEnvironments_ProjectId] ON [dbo].[QaEnvironments]
(
	[ProjectId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_QaMilestones_ProjectId]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_QaMilestones_ProjectId] ON [dbo].[QaMilestones]
(
	[ProjectId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_QaMilestoneTestPlans_TestPlanId]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_QaMilestoneTestPlans_TestPlanId] ON [dbo].[QaMilestoneTestPlans]
(
	[TestPlanId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_QaModules_ProjectId]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_QaModules_ProjectId] ON [dbo].[QaModules]
(
	[ProjectId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_QaReleases_ProjectId]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_QaReleases_ProjectId] ON [dbo].[QaReleases]
(
	[ProjectId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_QaRequirements_ProjectId]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_QaRequirements_ProjectId] ON [dbo].[QaRequirements]
(
	[ProjectId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_QaRequirementTestCases_TestCaseId]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_QaRequirementTestCases_TestCaseId] ON [dbo].[QaRequirementTestCases]
(
	[TestCaseId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_QaTestCaseRunTypes_RunTypeId]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_QaTestCaseRunTypes_RunTypeId] ON [dbo].[QaTestCaseRunTypes]
(
	[RunTypeId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_QaTestCases_ProjectId]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_QaTestCases_ProjectId] ON [dbo].[QaTestCases]
(
	[ProjectId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_QaTestCases_Status]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_QaTestCases_Status] ON [dbo].[QaTestCases]
(
	[Status] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_QaTestCases_TestSuiteId]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_QaTestCases_TestSuiteId] ON [dbo].[QaTestCases]
(
	[TestSuiteId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_QaTestCaseSteps_TestCaseId]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_QaTestCaseSteps_TestCaseId] ON [dbo].[QaTestCaseSteps]
(
	[TestCaseId] ASC,
	[StepNumber] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_QaTestCaseTags_TestCaseId]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_QaTestCaseTags_TestCaseId] ON [dbo].[QaTestCaseTags]
(
	[TestCaseId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_QaTestExecutions_TestRunCaseId_ExecutedAt]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_QaTestExecutions_TestRunCaseId_ExecutedAt] ON [dbo].[QaTestExecutions]
(
	[TestRunCaseId] ASC,
	[ExecutedAt] DESC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_QaTestPlanRuns_TestRunId]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_QaTestPlanRuns_TestRunId] ON [dbo].[QaTestPlanRuns]
(
	[TestRunId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_QaTestPlans_ProjectId]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_QaTestPlans_ProjectId] ON [dbo].[QaTestPlans]
(
	[ProjectId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_QaTestRunCases_AssignedUserId]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_QaTestRunCases_AssignedUserId] ON [dbo].[QaTestRunCases]
(
	[AssignedUserId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_QaTestRunCases_TestRunId]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_QaTestRunCases_TestRunId] ON [dbo].[QaTestRunCases]
(
	[TestRunId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_QaTestRuns_BuildId]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_QaTestRuns_BuildId] ON [dbo].[QaTestRuns]
(
	[BuildId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_QaTestRuns_EnvironmentId]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_QaTestRuns_EnvironmentId] ON [dbo].[QaTestRuns]
(
	[EnvironmentId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_QaTestRuns_ProjectId]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_QaTestRuns_ProjectId] ON [dbo].[QaTestRuns]
(
	[ProjectId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_QaTestRuns_RunTypeId]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_QaTestRuns_RunTypeId] ON [dbo].[QaTestRuns]
(
	[RunTypeId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_QaTestRuns_Status]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_QaTestRuns_Status] ON [dbo].[QaTestRuns]
(
	[Status] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_QaTestSuites_ProjectId]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_QaTestSuites_ProjectId] ON [dbo].[QaTestSuites]
(
	[ProjectId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_QaTestSuites_Status]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_QaTestSuites_Status] ON [dbo].[QaTestSuites]
(
	[Status] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_RemoteApprovalRequests_Status]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_RemoteApprovalRequests_Status] ON [dbo].[RemoteApprovalRequests]
(
	[Status] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_RemoteAuditLog_CreatedAt]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_RemoteAuditLog_CreatedAt] ON [dbo].[RemoteAuditLog]
(
	[CreatedAt] DESC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_RemoteAuditLog_EventType]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_RemoteAuditLog_EventType] ON [dbo].[RemoteAuditLog]
(
	[EventType] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_RemoteCertificates_Host_Port]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_RemoteCertificates_Host_Port] ON [dbo].[RemoteCertificates]
(
	[Host] ASC,
	[Port] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_RemoteConnectionChecks_ConnectionId_CheckedAt]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_RemoteConnectionChecks_ConnectionId_CheckedAt] ON [dbo].[RemoteConnectionChecks]
(
	[ConnectionId] ASC,
	[CheckedAt] DESC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_RemoteConnections_AvailabilityStatus]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_RemoteConnections_AvailabilityStatus] ON [dbo].[RemoteConnections]
(
	[AvailabilityStatus] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_RemoteConnections_GroupId]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_RemoteConnections_GroupId] ON [dbo].[RemoteConnections]
(
	[GroupId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_RemoteProtocolDiagnostics_ConnectionId]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_RemoteProtocolDiagnostics_ConnectionId] ON [dbo].[RemoteProtocolDiagnostics]
(
	[ConnectionId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_RemoteScriptExecutions_BatchId]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_RemoteScriptExecutions_BatchId] ON [dbo].[RemoteScriptExecutions]
(
	[BatchId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_RemoteSessionEvents_Session]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_RemoteSessionEvents_Session] ON [dbo].[RemoteSessionEvents]
(
	[SessionId] ASC,
	[CreatedAt] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_RemoteSessionFileTransfers_Session]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_RemoteSessionFileTransfers_Session] ON [dbo].[RemoteSessionFileTransfers]
(
	[SessionId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_RemoteSessionLogs_SessionId_Sequence]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_RemoteSessionLogs_SessionId_Sequence] ON [dbo].[RemoteSessionLogs]
(
	[SessionId] ASC,
	[Sequence] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_RemoteSessions_Status]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_RemoteSessions_Status] ON [dbo].[RemoteSessions]
(
	[Status] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_RemoteSessionSignaling_Poll]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_RemoteSessionSignaling_Poll] ON [dbo].[RemoteSessionSignaling]
(
	[SessionId] ASC,
	[Direction] ASC,
	[ConsumedAt] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_RemoteSupportSessions_Device]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_RemoteSupportSessions_Device] ON [dbo].[RemoteSupportSessions]
(
	[DeviceId] ASC,
	[Status] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_RemoteSupportSessions_Status]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_RemoteSupportSessions_Status] ON [dbo].[RemoteSupportSessions]
(
	[Status] ASC,
	[ExpiresAt] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_RepoConnections_DeletedAt]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_RepoConnections_DeletedAt] ON [dbo].[RepoConnections]
(
	[DeletedAt] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_RepoConnections_Provider]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_RepoConnections_Provider] ON [dbo].[RepoConnections]
(
	[Provider] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_RouterBandwidth_Interface]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_RouterBandwidth_Interface] ON [dbo].[RouterBandwidth]
(
	[Interface] ASC,
	[ReceivedAt] DESC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_RouterClients_MacAddress_UpdatedAt]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_RouterClients_MacAddress_UpdatedAt] ON [dbo].[RouterClients]
(
	[MacAddress] ASC,
	[UpdatedAt] DESC
)
INCLUDE ( 	[IpAddress],
	[Hostname],
	[Status],
	[LastSeenRaw],
	[Os],
	[FirstSeen]) WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_RouterClientTraffic_ReceivedAt]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_RouterClientTraffic_ReceivedAt] ON [dbo].[RouterClientTraffic]
(
	[ReceivedAt] DESC
)
INCLUDE ( 	[SrcAddress],
	[DstAddress],
	[Bytes]) WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_RouterHealth_ReceivedAt]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_RouterHealth_ReceivedAt] ON [dbo].[RouterHealth]
(
	[ReceivedAt] DESC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_RouterWebLogs_DstIp_ReceivedAt]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_RouterWebLogs_DstIp_ReceivedAt] ON [dbo].[RouterWebLogs]
(
	[DstIp] ASC,
	[ReceivedAt] DESC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_RouterWebLogs_ReceivedAt]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_RouterWebLogs_ReceivedAt] ON [dbo].[RouterWebLogs]
(
	[ReceivedAt] DESC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_RouterWebLogs_SrcIp]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_RouterWebLogs_SrcIp] ON [dbo].[RouterWebLogs]
(
	[SrcIp] ASC,
	[ReceivedAt] ASC
)
INCLUDE ( 	[DstIp],
	[DstPort],
	[ReverseDns]) WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_ScheduledReports_Active_NextSendAt]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_ScheduledReports_Active_NextSendAt] ON [dbo].[ScheduledReports]
(
	[IsActive] ASC,
	[NextSendAt] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_Screenshots_DeviceId_CapturedAt]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_Screenshots_DeviceId_CapturedAt] ON [dbo].[Screenshots]
(
	[DeviceId] ASC,
	[CapturedAt] DESC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_SecurityAlerts_Category]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_SecurityAlerts_Category] ON [dbo].[SecurityAlerts]
(
	[Category] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_SecurityAlerts_CreatedAt]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_SecurityAlerts_CreatedAt] ON [dbo].[SecurityAlerts]
(
	[CreatedAt] DESC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_SecurityAlerts_GroupingKey]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_SecurityAlerts_GroupingKey] ON [dbo].[SecurityAlerts]
(
	[GroupingKey] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_SecurityAlerts_GroupingKey_LastSeenAt_Active]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_SecurityAlerts_GroupingKey_LastSeenAt_Active] ON [dbo].[SecurityAlerts]
(
	[GroupingKey] ASC,
	[LastSeenAt] DESC
)
INCLUDE ( 	[Id],
	[Status]) WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_SecurityAlerts_Severity]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_SecurityAlerts_Severity] ON [dbo].[SecurityAlerts]
(
	[Severity] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_SecurityAlerts_Severity_Status]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_SecurityAlerts_Severity_Status] ON [dbo].[SecurityAlerts]
(
	[Severity] ASC,
	[Status] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_SecurityAlerts_SourceIp]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_SecurityAlerts_SourceIp] ON [dbo].[SecurityAlerts]
(
	[SourceIp] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_SecurityAlerts_Status]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_SecurityAlerts_Status] ON [dbo].[SecurityAlerts]
(
	[Status] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_SecurityCenterScoreSnapshots_SnapshotAt]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_SecurityCenterScoreSnapshots_SnapshotAt] ON [dbo].[SecurityCenterScoreSnapshots]
(
	[SnapshotAt] DESC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_SecurityCollectorHealth_CheckedAt]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_SecurityCollectorHealth_CheckedAt] ON [dbo].[SecurityCollectorHealth]
(
	[CheckedAt] DESC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_SecurityEvents_AlertId]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_SecurityEvents_AlertId] ON [dbo].[SecurityEvents]
(
	[AlertId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_SecurityEvents_CreatedAt]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_SecurityEvents_CreatedAt] ON [dbo].[SecurityEvents]
(
	[CreatedAt] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_SecurityEvents_DataSource]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_SecurityEvents_DataSource] ON [dbo].[SecurityEvents]
(
	[DataSource] ASC,
	[EventTime] DESC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_SecurityEvents_EventTime]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_SecurityEvents_EventTime] ON [dbo].[SecurityEvents]
(
	[EventTime] DESC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_SecurityEvents_LogSourceId]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_SecurityEvents_LogSourceId] ON [dbo].[SecurityEvents]
(
	[LogSourceId] ASC,
	[EventTime] DESC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_SecurityEvents_SourceIp]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_SecurityEvents_SourceIp] ON [dbo].[SecurityEvents]
(
	[SourceIp] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_SecurityFileIntegrityBaselines_FilePath]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE UNIQUE NONCLUSTERED INDEX [IX_SecurityFileIntegrityBaselines_FilePath] ON [dbo].[SecurityFileIntegrityBaselines]
(
	[FilePath] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, IGNORE_DUP_KEY = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_SecurityHeaderScans_ScannedAt]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_SecurityHeaderScans_ScannedAt] ON [dbo].[SecurityHeaderScans]
(
	[ScannedAt] DESC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_SecurityHeaderScans_WebsiteId]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_SecurityHeaderScans_WebsiteId] ON [dbo].[SecurityHeaderScans]
(
	[WebsiteId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_SecurityIncidents_Status]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_SecurityIncidents_Status] ON [dbo].[SecurityIncidents]
(
	[Status] ASC,
	[CreatedAt] DESC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [UX_SecurityIncidents_Number]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE UNIQUE NONCLUSTERED INDEX [UX_SecurityIncidents_Number] ON [dbo].[SecurityIncidents]
(
	[IncidentNumber] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, IGNORE_DUP_KEY = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_SecurityIpProfiles_LastSeenAt]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_SecurityIpProfiles_LastSeenAt] ON [dbo].[SecurityIpProfiles]
(
	[LastSeenAt] DESC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [UX_SecurityLogSources_SourceDeviceId_SourceSiteName]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE UNIQUE NONCLUSTERED INDEX [UX_SecurityLogSources_SourceDeviceId_SourceSiteName] ON [dbo].[SecurityLogSources]
(
	[SourceDeviceId] ASC,
	[SourceSiteName] ASC
)
WHERE ([SourceDeviceId] IS NOT NULL AND [SourceSiteName] IS NOT NULL)
WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, IGNORE_DUP_KEY = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_SecurityProtectedApplications_WebsiteId]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE UNIQUE NONCLUSTERED INDEX [IX_SecurityProtectedApplications_WebsiteId] ON [dbo].[SecurityProtectedApplications]
(
	[WebsiteId] ASC
)
WHERE ([WebsiteId] IS NOT NULL)
WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, IGNORE_DUP_KEY = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_SeoScans_ScannedAt]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_SeoScans_ScannedAt] ON [dbo].[SeoScans]
(
	[ScannedAt] DESC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_SeoScans_WebsiteId]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_SeoScans_WebsiteId] ON [dbo].[SeoScans]
(
	[WebsiteId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_ServerLogEntries_DeviceId_LogSource_ReceivedAt]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_ServerLogEntries_DeviceId_LogSource_ReceivedAt] ON [dbo].[ServerLogEntries]
(
	[DeviceId] ASC,
	[LogSource] ASC,
	[ReceivedAt] DESC
)
INCLUDE ( 	[Severity],
	[Message]) WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_ServerLogEntries_DeviceId_ReceivedAt]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_ServerLogEntries_DeviceId_ReceivedAt] ON [dbo].[ServerLogEntries]
(
	[DeviceId] ASC,
	[ReceivedAt] DESC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_ServerLogEntries_LogSource_ReceivedAt]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_ServerLogEntries_LogSource_ReceivedAt] ON [dbo].[ServerLogEntries]
(
	[LogSource] ASC,
	[ReceivedAt] DESC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_ServerLogEntries_SiteName]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_ServerLogEntries_SiteName] ON [dbo].[ServerLogEntries]
(
	[SiteName] ASC
)
WHERE ([SiteName] IS NOT NULL)
WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_ServerRoomEntries_Active]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_ServerRoomEntries_Active] ON [dbo].[ServerRoomEntries]
(
	[ExitAt] ASC,
	[EntryAt] DESC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_ServerRoomEntries_EntryAt]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_ServerRoomEntries_EntryAt] ON [dbo].[ServerRoomEntries]
(
	[EntryAt] DESC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_ServerRoomTasks_Entry]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_ServerRoomTasks_Entry] ON [dbo].[ServerRoomTasks]
(
	[EntryId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_ServerRoomTasks_Group]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_ServerRoomTasks_Group] ON [dbo].[ServerRoomTasks]
(
	[TaskGroup] ASC,
	[Status] ASC,
	[StartAt] DESC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_ServerRoomTasks_Start]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_ServerRoomTasks_Start] ON [dbo].[ServerRoomTasks]
(
	[StartAt] DESC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_SoftwareInventory_AssetId]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_SoftwareInventory_AssetId] ON [dbo].[SoftwareInventory]
(
	[AssetId] ASC
)
WHERE ([IsDeleted]=(0))
WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_SoftwareInventory_LicenceExpiryDate]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_SoftwareInventory_LicenceExpiryDate] ON [dbo].[SoftwareInventory]
(
	[LicenceExpiryDate] ASC
)
WHERE ([IsDeleted]=(0))
WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_SoftwareInventory_SoftwareStatus]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_SoftwareInventory_SoftwareStatus] ON [dbo].[SoftwareInventory]
(
	[SoftwareStatus] ASC
)
WHERE ([IsDeleted]=(0))
WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_SophosClients_MacAddress_UpdatedAt]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_SophosClients_MacAddress_UpdatedAt] ON [dbo].[SophosClients]
(
	[MacAddress] ASC,
	[UpdatedAt] DESC
)
INCLUDE ( 	[IpAddress],
	[Hostname],
	[Os],
	[FirstSeen]) WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_SophosEventLogs_LogComponent]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_SophosEventLogs_LogComponent] ON [dbo].[SophosEventLogs]
(
	[LogComponent] ASC,
	[ReceivedAt] DESC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_SophosEventLogs_ReceivedAt]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_SophosEventLogs_ReceivedAt] ON [dbo].[SophosEventLogs]
(
	[ReceivedAt] DESC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_SophosThreatLogs_LogType]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_SophosThreatLogs_LogType] ON [dbo].[SophosThreatLogs]
(
	[LogType] ASC,
	[ReceivedAt] DESC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_SophosThreatLogs_ReceivedAt]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_SophosThreatLogs_ReceivedAt] ON [dbo].[SophosThreatLogs]
(
	[ReceivedAt] DESC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_SophosThreatLogs_ReceivedAt_Covering]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_SophosThreatLogs_ReceivedAt_Covering] ON [dbo].[SophosThreatLogs]
(
	[ReceivedAt] ASC
)
INCLUDE ( 	[Status],
	[Severity]) WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_SqlServerActiveSessions_InstanceId]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_SqlServerActiveSessions_InstanceId] ON [dbo].[SqlServerActiveSessions]
(
	[InstanceId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_SqlServerBlockingEvents_InstanceId_DetectedAt]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_SqlServerBlockingEvents_InstanceId_DetectedAt] ON [dbo].[SqlServerBlockingEvents]
(
	[InstanceId] ASC,
	[DetectedAt] DESC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_SqlServerDatabaseSnapshots_InstanceId]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_SqlServerDatabaseSnapshots_InstanceId] ON [dbo].[SqlServerDatabaseSnapshots]
(
	[InstanceId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_SqlServerDeadlockEvents_InstanceId_DetectedAt]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_SqlServerDeadlockEvents_InstanceId_DetectedAt] ON [dbo].[SqlServerDeadlockEvents]
(
	[InstanceId] ASC,
	[DetectedAt] DESC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_SqlServerMetricsSnapshots_InstanceId_ReceivedAt]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_SqlServerMetricsSnapshots_InstanceId_ReceivedAt] ON [dbo].[SqlServerMetricsSnapshots]
(
	[InstanceId] ASC,
	[ReceivedAt] DESC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_SqlServerSlowQueries_InstanceId_DetectedAt]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_SqlServerSlowQueries_InstanceId_DetectedAt] ON [dbo].[SqlServerSlowQueries]
(
	[InstanceId] ASC,
	[DetectedAt] DESC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_Staff_WacGroupId]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_Staff_WacGroupId] ON [dbo].[Staff]
(
	[WacGroupId] ASC
)
WHERE ([WacGroupId] IS NOT NULL)
WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [UX_Staff_AdObjectGuid]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE UNIQUE NONCLUSTERED INDEX [UX_Staff_AdObjectGuid] ON [dbo].[Staff]
(
	[AdObjectGuid] ASC
)
WHERE ([AdObjectGuid] IS NOT NULL)
WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, IGNORE_DUP_KEY = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [UX_Staff_MacAddress]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE UNIQUE NONCLUSTERED INDEX [UX_Staff_MacAddress] ON [dbo].[Staff]
(
	[MacAddress] ASC
)
WHERE ([MacAddress] IS NOT NULL)
WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, IGNORE_DUP_KEY = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_SupportTickets_Status]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_SupportTickets_Status] ON [dbo].[SupportTickets]
(
	[Status] ASC,
	[CreatedAt] DESC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_SystemHealthLogs_Component]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_SystemHealthLogs_Component] ON [dbo].[SystemHealthLogs]
(
	[LogComponent] ASC,
	[ReceivedAt] DESC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ARITHABORT ON
SET CONCAT_NULL_YIELDS_NULL ON
SET QUOTED_IDENTIFIER ON
SET ANSI_NULLS ON
SET ANSI_PADDING ON
SET ANSI_WARNINGS ON
SET NUMERIC_ROUNDABORT OFF
GO
/****** Object:  Index [IX_SystemHealthLogs_Interface_Name_ReceivedAt]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_SystemHealthLogs_Interface_Name_ReceivedAt] ON [dbo].[SystemHealthLogs]
(
	[InterfaceName] ASC,
	[ReceivedAt] DESC
)
INCLUDE ( 	[Fields]) 
WHERE ([LogComponent]='Interface')
WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_ThreatScans_CreatedAt]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_ThreatScans_CreatedAt] ON [dbo].[ThreatScans]
(
	[CreatedAt] DESC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_UpdateHistory_CreatedAt]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_UpdateHistory_CreatedAt] ON [dbo].[UpdateHistory]
(
	[CreatedAt] DESC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_UpdateHistory_Device]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_UpdateHistory_Device] ON [dbo].[UpdateHistory]
(
	[DeviceId] ASC,
	[CreatedAt] DESC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_UpdateHistory_Event]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_UpdateHistory_Event] ON [dbo].[UpdateHistory]
(
	[EventType] ASC,
	[CreatedAt] DESC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_UpdateInstallResults_Request]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_UpdateInstallResults_Request] ON [dbo].[UpdateInstallResults]
(
	[RequestId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_UpdateSchedules_Due]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_UpdateSchedules_Due] ON [dbo].[UpdateSchedules]
(
	[IsActive] ASC,
	[IsDeleted] ASC,
	[NextRunAt] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_UsbDevicePolicies_Action_Active]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_UsbDevicePolicies_Action_Active] ON [dbo].[UsbDevicePolicies]
(
	[Action] ASC,
	[IsActive] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_UserPasskeys_UserId]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_UserPasskeys_UserId] ON [dbo].[UserPasskeys]
(
	[UserId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_UserTotpRecoveryCodes_UserId]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_UserTotpRecoveryCodes_UserId] ON [dbo].[UserTotpRecoveryCodes]
(
	[UserId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_VulnerabilityFindings_ScanId]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_VulnerabilityFindings_ScanId] ON [dbo].[VulnerabilityFindings]
(
	[ScanId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_VulnerabilityFindings_Severity_Status]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_VulnerabilityFindings_Severity_Status] ON [dbo].[VulnerabilityFindings]
(
	[Severity] ASC,
	[Status] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_VulnerabilityScans_CreatedAt]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_VulnerabilityScans_CreatedAt] ON [dbo].[VulnerabilityScans]
(
	[CreatedAt] DESC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_WacCriticalAllowlist_Domain]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_WacCriticalAllowlist_Domain] ON [dbo].[WacCriticalAllowlist]
(
	[Domain] ASC
)
WHERE ([Domain] IS NOT NULL)
WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_WacSyncStatus_Policy]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE UNIQUE NONCLUSTERED INDEX [IX_WacSyncStatus_Policy] ON [dbo].[WacSyncStatus]
(
	[PolicyType] ASC,
	[PolicyId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, IGNORE_DUP_KEY = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_WacWebsiteRules_Domain]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_WacWebsiteRules_Domain] ON [dbo].[WacWebsiteRules]
(
	[Domain] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_WacWebsiteRules_StaffId]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_WacWebsiteRules_StaffId] ON [dbo].[WacWebsiteRules]
(
	[StaffId] ASC
)
WHERE ([StaffId] IS NOT NULL)
WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_WacWebsiteRules_WacGroupId]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_WacWebsiteRules_WacGroupId] ON [dbo].[WacWebsiteRules]
(
	[WacGroupId] ASC
)
WHERE ([WacGroupId] IS NOT NULL)
WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_WafAttackEvents_Action]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_WafAttackEvents_Action] ON [dbo].[WafAttackEvents]
(
	[Action] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_WafAttackEvents_ApplicationId]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_WafAttackEvents_ApplicationId] ON [dbo].[WafAttackEvents]
(
	[ApplicationId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_WafAttackEvents_RequestId]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE UNIQUE NONCLUSTERED INDEX [IX_WafAttackEvents_RequestId] ON [dbo].[WafAttackEvents]
(
	[RequestId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, IGNORE_DUP_KEY = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_WafAttackEvents_RuleId]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_WafAttackEvents_RuleId] ON [dbo].[WafAttackEvents]
(
	[RuleId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_WafAttackEvents_Severity]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_WafAttackEvents_Severity] ON [dbo].[WafAttackEvents]
(
	[Severity] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_WafAttackEvents_SourceIp]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_WafAttackEvents_SourceIp] ON [dbo].[WafAttackEvents]
(
	[SourceIp] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_WafAttackEvents_Timestamp]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_WafAttackEvents_Timestamp] ON [dbo].[WafAttackEvents]
(
	[EventTimestamp] DESC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_WafCountryRules_CountryCode]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE UNIQUE NONCLUSTERED INDEX [IX_WafCountryRules_CountryCode] ON [dbo].[WafCountryRules]
(
	[CountryCode] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, IGNORE_DUP_KEY = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_WafHealthChecks_ApplicationId_CheckedAt]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_WafHealthChecks_ApplicationId_CheckedAt] ON [dbo].[WafHealthChecks]
(
	[ApplicationId] ASC,
	[CheckedAt] DESC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_WafIpRules_ExpiresAt]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_WafIpRules_ExpiresAt] ON [dbo].[WafIpRules]
(
	[ExpiresAt] ASC
)
WHERE ([IsTemporary]=(1))
WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_WafIpRules_IpOrCidr]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_WafIpRules_IpOrCidr] ON [dbo].[WafIpRules]
(
	[IpOrCidr] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_WafRateLimits_ApplicationId]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_WafRateLimits_ApplicationId] ON [dbo].[WafRateLimits]
(
	[ApplicationId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_WafRequestLogs_ApplicationId]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_WafRequestLogs_ApplicationId] ON [dbo].[WafRequestLogs]
(
	[ApplicationId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_WafRequestLogs_RequestId]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE UNIQUE NONCLUSTERED INDEX [IX_WafRequestLogs_RequestId] ON [dbo].[WafRequestLogs]
(
	[RequestId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, IGNORE_DUP_KEY = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_WafRequestLogs_SourceIp]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_WafRequestLogs_SourceIp] ON [dbo].[WafRequestLogs]
(
	[SourceIp] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_WafRequestLogs_Timestamp]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_WafRequestLogs_Timestamp] ON [dbo].[WafRequestLogs]
(
	[EventTimestamp] DESC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_WafRuleExceptions_RuleId]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_WafRuleExceptions_RuleId] ON [dbo].[WafRuleExceptions]
(
	[RuleId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_WafRules_ApplicationId]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_WafRules_ApplicationId] ON [dbo].[WafRules]
(
	[ApplicationId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_WafRules_Enabled]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_WafRules_Enabled] ON [dbo].[WafRules]
(
	[Enabled] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_WatchedFiles_DeviceId]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_WatchedFiles_DeviceId] ON [dbo].[WatchedFiles]
(
	[DeviceId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_WOAgentVulns_DeviceId]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_WOAgentVulns_DeviceId] ON [dbo].[WazuhOfficeAgentVulnerabilities]
(
	[DeviceId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_WOAgentVulns_Status]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_WOAgentVulns_Status] ON [dbo].[WazuhOfficeAgentVulnerabilities]
(
	[Status] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_WOAlertComments_AlertId]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_WOAlertComments_AlertId] ON [dbo].[WazuhOfficeAlertComments]
(
	[AlertId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_WOAlerts_DeviceId_TriggeredAt]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_WOAlerts_DeviceId_TriggeredAt] ON [dbo].[WazuhOfficeAlerts]
(
	[DeviceId] ASC,
	[TriggeredAt] DESC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_WOAlerts_Severity]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_WOAlerts_Severity] ON [dbo].[WazuhOfficeAlerts]
(
	[Severity] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_WOAlerts_Status]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_WOAlerts_Status] ON [dbo].[WazuhOfficeAlerts]
(
	[Status] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_WOAlerts_TriggeredAt]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_WOAlerts_TriggeredAt] ON [dbo].[WazuhOfficeAlerts]
(
	[TriggeredAt] DESC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_WOCpuMetrics_DeviceId_CapturedAt]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_WOCpuMetrics_DeviceId_CapturedAt] ON [dbo].[WazuhOfficeCpuMetrics]
(
	[DeviceId] ASC,
	[CapturedAt] DESC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_WODiskMetrics_DeviceId_CapturedAt]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_WODiskMetrics_DeviceId_CapturedAt] ON [dbo].[WazuhOfficeDiskMetrics]
(
	[DeviceId] ASC,
	[CapturedAt] DESC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_WOFimEvents_DeviceId_DetectedAt]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_WOFimEvents_DeviceId_DetectedAt] ON [dbo].[WazuhOfficeFileIntegrityEvents]
(
	[DeviceId] ASC,
	[DetectedAt] DESC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_WOInventory_DeviceId_CapturedAt]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_WOInventory_DeviceId_CapturedAt] ON [dbo].[WazuhOfficeInventorySnapshots]
(
	[DeviceId] ASC,
	[CapturedAt] DESC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_WOMemMetrics_DeviceId_CapturedAt]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_WOMemMetrics_DeviceId_CapturedAt] ON [dbo].[WazuhOfficeMemoryMetrics]
(
	[DeviceId] ASC,
	[CapturedAt] DESC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_WONetConn_CapturedAt]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_WONetConn_CapturedAt] ON [dbo].[WazuhOfficeNetworkConnections]
(
	[CapturedAt] DESC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_WONetConn_DeviceId_CapturedAt]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_WONetConn_DeviceId_CapturedAt] ON [dbo].[WazuhOfficeNetworkConnections]
(
	[DeviceId] ASC,
	[CapturedAt] DESC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_WONotifCooldown_Scope]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_WONotifCooldown_Scope] ON [dbo].[WazuhOfficeNotificationCooldowns]
(
	[ChannelType] ASC,
	[RuleId] ASC,
	[DeviceId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_WOProcesses_CapturedAt]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_WOProcesses_CapturedAt] ON [dbo].[WazuhOfficeProcesses]
(
	[CapturedAt] DESC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_WOProcesses_DeviceId_CapturedAt]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_WOProcesses_DeviceId_CapturedAt] ON [dbo].[WazuhOfficeProcesses]
(
	[DeviceId] ASC,
	[CapturedAt] DESC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_WORules_Enabled]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_WORules_Enabled] ON [dbo].[WazuhOfficeRules]
(
	[Enabled] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_WOSecurityEvents_DeviceId_Timestamp]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_WOSecurityEvents_DeviceId_Timestamp] ON [dbo].[WazuhOfficeSecurityEvents]
(
	[DeviceId] ASC,
	[EventTimestamp] DESC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_WOSecurityEvents_Severity]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_WOSecurityEvents_Severity] ON [dbo].[WazuhOfficeSecurityEvents]
(
	[Severity] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_WOSecurityEvents_Timestamp]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_WOSecurityEvents_Timestamp] ON [dbo].[WazuhOfficeSecurityEvents]
(
	[EventTimestamp] DESC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_WOServices_CapturedAt]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_WOServices_CapturedAt] ON [dbo].[WazuhOfficeServices]
(
	[CapturedAt] DESC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_WOServices_DeviceId_CapturedAt]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_WOServices_DeviceId_CapturedAt] ON [dbo].[WazuhOfficeServices]
(
	[DeviceId] ASC,
	[CapturedAt] DESC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_WOTempMetrics_DeviceId_CapturedAt]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_WOTempMetrics_DeviceId_CapturedAt] ON [dbo].[WazuhOfficeTemperatureMetrics]
(
	[DeviceId] ASC,
	[CapturedAt] DESC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_WOVulnerabilities_Cve_Package]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE UNIQUE NONCLUSTERED INDEX [IX_WOVulnerabilities_Cve_Package] ON [dbo].[WazuhOfficeVulnerabilities]
(
	[Cve] ASC,
	[AffectedPackage] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, IGNORE_DUP_KEY = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_WebFilterLogs_DstIp_ReceivedAt]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_WebFilterLogs_DstIp_ReceivedAt] ON [dbo].[WebFilterLogs]
(
	[DstIp] ASC,
	[ReceivedAt] DESC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_WebFilterLogs_ReceivedAt]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_WebFilterLogs_ReceivedAt] ON [dbo].[WebFilterLogs]
(
	[ReceivedAt] DESC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_WebFilterLogs_ReceivedAt_TopConsumers]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_WebFilterLogs_ReceivedAt_TopConsumers] ON [dbo].[WebFilterLogs]
(
	[ReceivedAt] ASC
)
INCLUDE ( 	[SrcIp],
	[DstIp],
	[Domain],
	[Url],
	[BytesSent],
	[BytesReceived],
	[UserName]) WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_WebFilterLogs_SrcIp]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_WebFilterLogs_SrcIp] ON [dbo].[WebFilterLogs]
(
	[SrcIp] ASC,
	[ReceivedAt] ASC
)
INCLUDE ( 	[Domain],
	[Url],
	[Category],
	[Application],
	[Action],
	[BytesSent],
	[BytesReceived]) WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_WebsiteAuditScanLog_ScanId]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_WebsiteAuditScanLog_ScanId] ON [dbo].[WebsiteAuditScanLog]
(
	[ScanId] ASC,
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_WebsiteIncidentReports_WebsiteName]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_WebsiteIncidentReports_WebsiteName] ON [dbo].[WebsiteIncidentReports]
(
	[WebsiteName] ASC,
	[CreatedAt] DESC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_WebsiteOptimizationChecks_ScanId]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_WebsiteOptimizationChecks_ScanId] ON [dbo].[WebsiteOptimizationChecks]
(
	[ScanId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_WebsitePerformanceAlerts_Unresolved]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_WebsitePerformanceAlerts_Unresolved] ON [dbo].[WebsitePerformanceAlerts]
(
	[ResolvedAt] ASC,
	[TriggeredAt] DESC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_WebsitePerformanceScans_Website_Device_CreatedAt]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_WebsitePerformanceScans_Website_Device_CreatedAt] ON [dbo].[WebsitePerformanceScans]
(
	[WebsiteId] ASC,
	[Device] ASC,
	[CreatedAt] DESC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_WebsiteSslStatus_ExpiresAt]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_WebsiteSslStatus_ExpiresAt] ON [dbo].[WebsiteSslStatus]
(
	[ExpiresAt] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_WifiAllowedDevices_StaffId]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_WifiAllowedDevices_StaffId] ON [dbo].[WifiAllowedDevices]
(
	[StaffId] ASC
)
WHERE ([StaffId] IS NOT NULL)
WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_WordPressDeepScans_ScannedAt]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_WordPressDeepScans_ScannedAt] ON [dbo].[WordPressDeepScans]
(
	[ScannedAt] DESC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_WordPressDeepScans_WebsiteId]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_WordPressDeepScans_WebsiteId] ON [dbo].[WordPressDeepScans]
(
	[WebsiteId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_WordPressFindings_Severity]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_WordPressFindings_Severity] ON [dbo].[WordPressFindings]
(
	[Severity] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_WordPressFindings_Status]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_WordPressFindings_Status] ON [dbo].[WordPressFindings]
(
	[Status] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_WordPressFindings_WebsiteId]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_WordPressFindings_WebsiteId] ON [dbo].[WordPressFindings]
(
	[WebsiteId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_WordPressFindingStatusHistory_FindingId]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_WordPressFindingStatusHistory_FindingId] ON [dbo].[WordPressFindingStatusHistory]
(
	[FindingId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_WordPressScanSchedules_NextRunAt]    Script Date: 11/4/2026 3:32:17 PM ******/
CREATE NONCLUSTERED INDEX [IX_WordPressScanSchedules_NextRunAt] ON [dbo].[WordPressScanSchedules]
(
	[NextRunAt] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
ALTER TABLE [dbo].[AdminAuditLog] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[AdSyncedComputers] ADD  CONSTRAINT [DF_AdSyncedComputers_Disabled]  DEFAULT ((0)) FOR [Disabled]
GO
ALTER TABLE [dbo].[AdSyncedUsers] ADD  CONSTRAINT [DF_AdSyncedUsers_AdDisabled]  DEFAULT ((0)) FOR [AdDisabled]
GO
ALTER TABLE [dbo].[AdSyncedUsers] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[AdSyncedUsers] ADD  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[AgentRolloutSettings] ADD  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[AlertContacts] ADD  DEFAULT ('Email') FOR [ContactType]
GO
ALTER TABLE [dbo].[AlertContacts] ADD  DEFAULT ('Unverified') FOR [VerificationStatus]
GO
ALTER TABLE [dbo].[AlertContacts] ADD  DEFAULT ((1)) FOR [IsActive]
GO
ALTER TABLE [dbo].[AlertContacts] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[AlertEscalationSteps] ADD  DEFAULT ((15)) FOR [DelayMinutes]
GO
ALTER TABLE [dbo].[AlertEscalationSteps] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[AlertPolicies] ADD  DEFAULT ((0)) FOR [IsDefault]
GO
ALTER TABLE [dbo].[AlertPolicies] ADD  DEFAULT ((1)) FOR [NotifyOnDown]
GO
ALTER TABLE [dbo].[AlertPolicies] ADD  DEFAULT ((1)) FOR [NotifyOnRecovery]
GO
ALTER TABLE [dbo].[AlertPolicies] ADD  DEFAULT ((0)) FOR [NotifyOnDegraded]
GO
ALTER TABLE [dbo].[AlertPolicies] ADD  DEFAULT ((1)) FOR [NotifyOnSslExpiring]
GO
ALTER TABLE [dbo].[AlertPolicies] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[AlertPolicies] ADD  DEFAULT ((0)) FOR [QuietHoursEnabled]
GO
ALTER TABLE [dbo].[AlertPolicies] ADD  DEFAULT ('UTC') FOR [QuietHoursTimezone]
GO
ALTER TABLE [dbo].[AlertPolicies] ADD  DEFAULT ((1)) FOR [QuietHoursAllowCritical]
GO
ALTER TABLE [dbo].[AlertPolicies] ADD  DEFAULT ((0)) FOR [EscalationEnabled]
GO
ALTER TABLE [dbo].[ApiMonitorConfigs] ADD  DEFAULT ('GET') FOR [HttpMethod]
GO
ALTER TABLE [dbo].[ApiMonitorConfigs] ADD  DEFAULT ('None') FOR [AuthType]
GO
ALTER TABLE [dbo].[ApiMonitorConfigs] ADD  DEFAULT ((200)) FOR [ExpectedStatusCode]
GO
ALTER TABLE [dbo].[ApiMonitorConfigs] ADD  DEFAULT ((1)) FOR [FollowRedirects]
GO
ALTER TABLE [dbo].[ApiMonitorConfigs] ADD  DEFAULT ((5)) FOR [MaxRedirects]
GO
ALTER TABLE [dbo].[ApiMonitorConfigs] ADD  DEFAULT ((1)) FOR [SslVerify]
GO
ALTER TABLE [dbo].[ApiMonitorConfigs] ADD  DEFAULT ((1000)) FOR [ResponseTimeWarningMs]
GO
ALTER TABLE [dbo].[ApiMonitorConfigs] ADD  DEFAULT ((3000)) FOR [ResponseTimeCriticalMs]
GO
ALTER TABLE [dbo].[AppActivitySettings] ADD  DEFAULT ((1)) FOR [Id]
GO
ALTER TABLE [dbo].[AppActivitySettings] ADD  DEFAULT ((300)) FOR [IdleTimeoutSeconds]
GO
ALTER TABLE [dbo].[AppActivitySettings] ADD  DEFAULT ((0)) FOR [CollectWindowTitles]
GO
ALTER TABLE [dbo].[AppActivitySettings] ADD  DEFAULT ((90)) FOR [RetentionDays]
GO
ALTER TABLE [dbo].[AppActivitySettings] ADD  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[AppCategories] ADD  DEFAULT ('none') FOR [RiskLevel]
GO
ALTER TABLE [dbo].[AppCategories] ADD  DEFAULT ((0)) FOR [IsBuiltIn]
GO
ALTER TABLE [dbo].[AppCategories] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[AppCategories] ADD  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[AppCategoryRules] ADD  DEFAULT ('exact') FOR [MatchType]
GO
ALTER TABLE [dbo].[AppCategoryRules] ADD  DEFAULT ('manual') FOR [Source]
GO
ALTER TABLE [dbo].[AppCategoryRules] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[AppUsageSessions] ADD  DEFAULT (sysutcdatetime()) FOR [ReceivedAt]
GO
ALTER TABLE [dbo].[AssetAttachments] ADD  DEFAULT (sysutcdatetime()) FOR [UploadedAt]
GO
ALTER TABLE [dbo].[AssetAttachments] ADD  DEFAULT ((0)) FOR [IsDeleted]
GO
ALTER TABLE [dbo].[Assets] ADD  DEFAULT ((0)) FOR [IsVirtual]
GO
ALTER TABLE [dbo].[Assets] ADD  DEFAULT ('Active') FOR [Status]
GO
ALTER TABLE [dbo].[Assets] ADD  DEFAULT ('Medium') FOR [Criticality]
GO
ALTER TABLE [dbo].[Assets] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[Assets] ADD  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[Assets] ADD  DEFAULT ((0)) FOR [IsDeleted]
GO
ALTER TABLE [dbo].[AutomationJobs] ADD  DEFAULT ((300)) FOR [TimeoutSeconds]
GO
ALTER TABLE [dbo].[AutomationJobs] ADD  DEFAULT ('Manual') FOR [TriggerType]
GO
ALTER TABLE [dbo].[AutomationJobs] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[AutomationJobTargets] ADD  DEFAULT ('Pending') FOR [Status]
GO
ALTER TABLE [dbo].[AutomationSchedules] ADD  DEFAULT (sysutcdatetime()) FOR [NextRunAt]
GO
ALTER TABLE [dbo].[AutomationSchedules] ADD  DEFAULT ((1)) FOR [IsActive]
GO
ALTER TABLE [dbo].[AutomationSchedules] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[AutomationSchedules] ADD  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[AutomationSchedules] ADD  DEFAULT ((0)) FOR [IsDeleted]
GO
ALTER TABLE [dbo].[AutomationScripts] ADD  DEFAULT ((300)) FOR [TimeoutSeconds]
GO
ALTER TABLE [dbo].[AutomationScripts] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[AutomationScripts] ADD  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[AutomationScripts] ADD  DEFAULT ((0)) FOR [IsDeleted]
GO
ALTER TABLE [dbo].[BackupHistory] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[BackupHistory] ADD  DEFAULT ('database') FOR [BackupType]
GO
ALTER TABLE [dbo].[BranchOffices] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[BranchOffices] ADD  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[BrowserActivityConsentAck] ADD  DEFAULT (sysutcdatetime()) FOR [AcknowledgedAt]
GO
ALTER TABLE [dbo].[BrowserActivityEngagementAlerts] ADD  DEFAULT (sysutcdatetime()) FOR [SentAt]
GO
ALTER TABLE [dbo].[BrowserActivityEvents] ADD  DEFAULT ('none') FOR [RiskLevel]
GO
ALTER TABLE [dbo].[BrowserActivityEvents] ADD  DEFAULT ((0)) FOR [IsSecurityEvent]
GO
ALTER TABLE [dbo].[BrowserActivityEvents] ADD  DEFAULT (sysutcdatetime()) FOR [ReceivedAt]
GO
ALTER TABLE [dbo].[BrowserActivitySettings] ADD  DEFAULT ((1)) FOR [Id]
GO
ALTER TABLE [dbo].[BrowserActivitySettings] ADD  DEFAULT ((90)) FOR [RetentionDays]
GO
ALTER TABLE [dbo].[BrowserActivitySettings] ADD  DEFAULT ((1)) FOR [CollectPageTitles]
GO
ALTER TABLE [dbo].[BrowserActivitySettings] ADD  DEFAULT ((15)) FOR [DefaultIntervalMinutes]
GO
ALTER TABLE [dbo].[BrowserActivitySettings] ADD  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[CameraMotionWatchers] ADD  DEFAULT ((0)) FOR [Enabled]
GO
ALTER TABLE [dbo].[CameraMotionWatchers] ADD  DEFAULT ('') FOR [Recipients]
GO
ALTER TABLE [dbo].[CameraMotionWatchers] ADD  DEFAULT ((4.5)) FOR [DiffThreshold]
GO
ALTER TABLE [dbo].[CameraMotionWatchers] ADD  DEFAULT ((120)) FOR [CooldownSeconds]
GO
ALTER TABLE [dbo].[CameraMotionWatchers] ADD  DEFAULT ((0)) FOR [BeepManish]
GO
ALTER TABLE [dbo].[ChatMessages] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[CodeQualityGitHubConnections] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[CodeQualityGitHubConnections] ADD  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[CodeQualityGitLabConnections] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[CodeQualityGitLabConnections] ADD  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[CodeQualityIssues] ADD  DEFAULT ('Open') FOR [Status]
GO
ALTER TABLE [dbo].[CodeQualityIssues] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[CodeQualityIssues] ADD  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[CodeQualityMetrics] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[CodeQualityProjects] ADD  DEFAULT ('Active') FOR [Status]
GO
ALTER TABLE [dbo].[CodeQualityProjects] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[CodeQualityProjects] ADD  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[CodeQualityRules] ADD  DEFAULT ((1)) FOR [Enabled]
GO
ALTER TABLE [dbo].[CodeQualityRules] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[CodeQualityRules] ADD  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[CodeQualityScanLog] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[CodeQualityScans] ADD  DEFAULT ('Full') FOR [ScanType]
GO
ALTER TABLE [dbo].[CodeQualityScans] ADD  DEFAULT ('Pending') FOR [Status]
GO
ALTER TABLE [dbo].[CodeQualityScans] ADD  DEFAULT ((0)) FOR [FilesScanned]
GO
ALTER TABLE [dbo].[CodeQualityScans] ADD  DEFAULT ((0)) FOR [LinesOfCode]
GO
ALTER TABLE [dbo].[CodeQualityScans] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[CodeQualitySettings] ADD  DEFAULT ((5)) FOR [ComplexityLowMax]
GO
ALTER TABLE [dbo].[CodeQualitySettings] ADD  DEFAULT ((10)) FOR [ComplexityMediumMax]
GO
ALTER TABLE [dbo].[CodeQualitySettings] ADD  DEFAULT ((20)) FOR [ComplexityHighMax]
GO
ALTER TABLE [dbo].[CodeQualitySettings] ADD  DEFAULT ((5)) FOR [DuplicationThresholdPercent]
GO
ALTER TABLE [dbo].[CodeQualitySettings] ADD  DEFAULT ((6)) FOR [MinDuplicateBlockSize]
GO
ALTER TABLE [dbo].[CodeQualitySettings] ADD  DEFAULT ((25)) FOR [WeightComplexity]
GO
ALTER TABLE [dbo].[CodeQualitySettings] ADD  DEFAULT ((20)) FOR [WeightDuplication]
GO
ALTER TABLE [dbo].[CodeQualitySettings] ADD  DEFAULT ((15)) FOR [WeightDeadCode]
GO
ALTER TABLE [dbo].[CodeQualitySettings] ADD  DEFAULT ((10)) FOR [WeightUnusedVariables]
GO
ALTER TABLE [dbo].[CodeQualitySettings] ADD  DEFAULT ((10)) FOR [WeightUnusedFunctions]
GO
ALTER TABLE [dbo].[CodeQualitySettings] ADD  DEFAULT ((20)) FOR [WeightCodingStandards]
GO
ALTER TABLE [dbo].[CodeQualitySettings] ADD  DEFAULT ((10)) FOR [ScaleComplexity]
GO
ALTER TABLE [dbo].[CodeQualitySettings] ADD  DEFAULT ((2)) FOR [ScaleDuplication]
GO
ALTER TABLE [dbo].[CodeQualitySettings] ADD  DEFAULT ((8)) FOR [ScaleDeadCode]
GO
ALTER TABLE [dbo].[CodeQualitySettings] ADD  DEFAULT ((6)) FOR [ScaleUnusedVariables]
GO
ALTER TABLE [dbo].[CodeQualitySettings] ADD  DEFAULT ((6)) FOR [ScaleUnusedFunctions]
GO
ALTER TABLE [dbo].[CodeQualitySettings] ADD  DEFAULT ((5)) FOR [ScaleCodingStandards]
GO
ALTER TABLE [dbo].[CodeQualitySettings] ADD  DEFAULT ('.ts,.tsx,.js,.jsx') FOR [AllowedExtensions]
GO
ALTER TABLE [dbo].[CodeQualitySettings] ADD  DEFAULT ((500)) FOR [MaxScanSizeMb]
GO
ALTER TABLE [dbo].[CodeQualitySettings] ADD  DEFAULT ((1800)) FOR [ScanTimeoutSeconds]
GO
ALTER TABLE [dbo].[CodeQualitySettings] ADD  DEFAULT ((90)) FOR [RetentionDays]
GO
ALTER TABLE [dbo].[CodeQualitySettings] ADD  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[CodeQualitySettings] ADD  DEFAULT ((120)) FOR [MaxLineLength]
GO
ALTER TABLE [dbo].[CompanySettings] ADD  DEFAULT ((0)) FOR [LoginBrandingEnabled]
GO
ALTER TABLE [dbo].[CompanySettings] ADD  DEFAULT ((0)) FOR [MaintenanceModeEnabled]
GO
ALTER TABLE [dbo].[CompanySettings] ADD  DEFAULT ((0)) FOR [BackupScheduleEnabled]
GO
ALTER TABLE [dbo].[CompanySettings] ADD  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[ComplianceControlEvidence] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[ComplianceControls] ADD  DEFAULT ((0)) FOR [SortOrder]
GO
ALTER TABLE [dbo].[ComplianceControls] ADD  DEFAULT ('not_started') FOR [Status]
GO
ALTER TABLE [dbo].[ComplianceControls] ADD  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[ContactMessages] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[DashboardLayouts] ADD  DEFAULT ((0)) FOR [IsActive]
GO
ALTER TABLE [dbo].[DashboardLayouts] ADD  DEFAULT ((900)) FOR [RefreshIntervalSeconds]
GO
ALTER TABLE [dbo].[DashboardLayouts] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[DashboardLayouts] ADD  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[DashboardNotes] ADD  DEFAULT ('') FOR [Content]
GO
ALTER TABLE [dbo].[DashboardNotes] ADD  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[DbAnalyzerAiConfig] ADD  DEFAULT ('non_ai') FOR [Mode]
GO
ALTER TABLE [dbo].[DbAnalyzerAiConfig] ADD  DEFAULT ((0)) FOR [Enabled]
GO
ALTER TABLE [dbo].[DbAnalyzerConnections] ADD  DEFAULT ((1)) FOR [Enabled]
GO
ALTER TABLE [dbo].[DbAnalyzerConnections] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[DbAnalyzerConnections] ADD  DEFAULT ('live') FOR [Source]
GO
ALTER TABLE [dbo].[Departments] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[Departments] ADD  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[DeviceAlerts] ADD  DEFAULT (sysutcdatetime()) FOR [TriggeredAt]
GO
ALTER TABLE [dbo].[DeviceDisks] ADD  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[DeviceHardwareInfo] ADD  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[DeviceLocalUsers] ADD  DEFAULT ((0)) FOR [IsAdmin]
GO
ALTER TABLE [dbo].[DeviceLocalUsers] ADD  DEFAULT ((0)) FOR [IsDisabled]
GO
ALTER TABLE [dbo].[DeviceLocalUsers] ADD  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[DeviceMetrics] ADD  DEFAULT (sysutcdatetime()) FOR [ReceivedAt]
GO
ALTER TABLE [dbo].[DeviceNetworkInfo] ADD  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[DeviceNetworkInterfaces] ADD  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[DeviceProcessSnapshot] ADD  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[Devices] ADD  DEFAULT (sysutcdatetime()) FOR [EnrolledAt]
GO
ALTER TABLE [dbo].[Devices] ADD  DEFAULT ((0)) FOR [PrivacyMode]
GO
ALTER TABLE [dbo].[Devices] ADD  CONSTRAINT [DF_Devices_DeviceType]  DEFAULT ('Workstation') FOR [DeviceType]
GO
ALTER TABLE [dbo].[Devices] ADD  CONSTRAINT [DF_Devices_LifecycleStatus]  DEFAULT ('Pending') FOR [LifecycleStatus]
GO
ALTER TABLE [dbo].[Devices] ADD  DEFAULT ((0)) FOR [LastNotificationSeenId]
GO
ALTER TABLE [dbo].[Devices] ADD  DEFAULT ((0)) FOR [IisDetected]
GO
ALTER TABLE [dbo].[Devices] ADD  DEFAULT ((0)) FOR [LinuxSecurityDetected]
GO
ALTER TABLE [dbo].[Devices] ADD  DEFAULT ((0)) FOR [PhpDetected]
GO
ALTER TABLE [dbo].[Devices] ADD  DEFAULT ((0)) FOR [WebsiteBlockingEnabled]
GO
ALTER TABLE [dbo].[Devices] ADD  DEFAULT ((0)) FOR [IsRevoked]
GO
ALTER TABLE [dbo].[DeviceSecurityStatus] ADD  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[DeviceServiceSnapshot] ADD  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[DeviceSoftwareSnapshot] ADD  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[DeviceUpdates] ADD  CONSTRAINT [DF_DeviceUpdates_Severity]  DEFAULT ('none') FOR [Severity]
GO
ALTER TABLE [dbo].[DeviceUpdates] ADD  CONSTRAINT [DF_DeviceUpdates_RequiresReboot]  DEFAULT ((0)) FOR [RequiresReboot]
GO
ALTER TABLE [dbo].[DeviceUpdates] ADD  CONSTRAINT [DF_DeviceUpdates_IsDisruptive]  DEFAULT ((0)) FOR [IsDisruptive]
GO
ALTER TABLE [dbo].[DeviceUpdates] ADD  CONSTRAINT [DF_DeviceUpdates_FirstSeenAt]  DEFAULT (sysutcdatetime()) FOR [FirstSeenAt]
GO
ALTER TABLE [dbo].[DeviceUpdates] ADD  CONSTRAINT [DF_DeviceUpdates_LastSeenAt]  DEFAULT (sysutcdatetime()) FOR [LastSeenAt]
GO
ALTER TABLE [dbo].[DeviceUpdateScans] ADD  CONSTRAINT [DF_DeviceUpdateScans_ScannedAt]  DEFAULT (sysutcdatetime()) FOR [ScannedAt]
GO
ALTER TABLE [dbo].[DeviceUsbEvents] ADD  DEFAULT (sysutcdatetime()) FOR [DetectedAt]
GO
ALTER TABLE [dbo].[DeviceVolumes] ADD  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[DomainCategories] ADD  DEFAULT ('none') FOR [RiskLevel]
GO
ALTER TABLE [dbo].[DomainCategories] ADD  DEFAULT ((0)) FOR [IsBuiltIn]
GO
ALTER TABLE [dbo].[DomainCategories] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[DomainCategories] ADD  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[DomainCategoryRules] ADD  DEFAULT ('suffix') FOR [MatchType]
GO
ALTER TABLE [dbo].[DomainCategoryRules] ADD  DEFAULT ('manual') FOR [Source]
GO
ALTER TABLE [dbo].[DomainCategoryRules] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[EmailDeliveryLog] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[EmailSecurityScans] ADD  DEFAULT (sysutcdatetime()) FOR [ScannedAt]
GO
ALTER TABLE [dbo].[EmployeeNotifications] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[EnrollmentTokens] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[ExcludedDomains] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[FileIntegrityEvents] ADD  DEFAULT (sysutcdatetime()) FOR [DetectedAt]
GO
ALTER TABLE [dbo].[HelpArticleFeedback] ADD  CONSTRAINT [DF_HelpArticleFeedback_CreatedAt]  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[HelpArticles] ADD  CONSTRAINT [DF_HelpArticles_Type]  DEFAULT ('article') FOR [Type]
GO
ALTER TABLE [dbo].[HelpArticles] ADD  CONSTRAINT [DF_HelpArticles_Status]  DEFAULT ('draft') FOR [Status]
GO
ALTER TABLE [dbo].[HelpArticles] ADD  CONSTRAINT [DF_HelpArticles_CreatedAt]  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[HelpArticles] ADD  CONSTRAINT [DF_HelpArticles_UpdatedAt]  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[IisAppPools] ADD  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[IisPerfSnapshots] ADD  DEFAULT (sysutcdatetime()) FOR [ReceivedAt]
GO
ALTER TABLE [dbo].[IisSites] ADD  DEFAULT ((0)) FOR [IsAvailable]
GO
ALTER TABLE [dbo].[IisSites] ADD  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[IisWorkerProcesses] ADD  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[InAppNotifications] ADD  DEFAULT ((0)) FOR [IsRead]
GO
ALTER TABLE [dbo].[InAppNotifications] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[IncidentEscalations] ADD  DEFAULT (sysutcdatetime()) FOR [FiredAt]
GO
ALTER TABLE [dbo].[IncidentNotes] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[IncidentReports] ADD  DEFAULT (sysutcdatetime()) FOR [UploadedAt]
GO
ALTER TABLE [dbo].[Incidents] ADD  DEFAULT ('Medium') FOR [Severity]
GO
ALTER TABLE [dbo].[Incidents] ADD  DEFAULT ('Open') FOR [Status]
GO
ALTER TABLE [dbo].[Incidents] ADD  DEFAULT (sysutcdatetime()) FOR [StartedAt]
GO
ALTER TABLE [dbo].[IncidentTimeline] ADD  CONSTRAINT [DF_IncidentTimeline_CreatedAt]  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[Integrations] ADD  DEFAULT ((0)) FOR [Enabled]
GO
ALTER TABLE [dbo].[Integrations] ADD  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[ItAssetImportHistory] ADD  DEFAULT ((0)) FOR [TotalRows]
GO
ALTER TABLE [dbo].[ItAssetImportHistory] ADD  DEFAULT ((0)) FOR [ImportedRows]
GO
ALTER TABLE [dbo].[ItAssetImportHistory] ADD  DEFAULT ((0)) FOR [FailedRows]
GO
ALTER TABLE [dbo].[ItAssetImportHistory] ADD  DEFAULT (sysutcdatetime()) FOR [ImportedAt]
GO
ALTER TABLE [dbo].[ItAssetLookupValues] ADD  DEFAULT ((0)) FOR [SortOrder]
GO
ALTER TABLE [dbo].[ItAssetLookupValues] ADD  DEFAULT ((1)) FOR [IsActive]
GO
ALTER TABLE [dbo].[ItAssetLookupValues] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[ItAssetNotifications] ADD  DEFAULT ('Medium') FOR [Severity]
GO
ALTER TABLE [dbo].[ItAssetNotifications] ADD  DEFAULT ((0)) FOR [IsRead]
GO
ALTER TABLE [dbo].[ItAssetNotifications] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[ItAssetSettings] ADD  DEFAULT ((1)) FOR [Id]
GO
ALTER TABLE [dbo].[ItAssetSettings] ADD  DEFAULT ((14)) FOR [PasswordDueSoonDays]
GO
ALTER TABLE [dbo].[ItAssetSettings] ADD  DEFAULT ((7)) FOR [PatchDueSoonDays]
GO
ALTER TABLE [dbo].[ItAssetSettings] ADD  DEFAULT ((7)) FOR [MaintenanceDueSoonDays]
GO
ALTER TABLE [dbo].[ItAssetSettings] ADD  DEFAULT ((30)) FOR [WarrantyExpiryWarningDays]
GO
ALTER TABLE [dbo].[ItAssetSettings] ADD  DEFAULT ((30)) FOR [LicenceExpiryWarningDays]
GO
ALTER TABLE [dbo].[ItAssetSettings] ADD  DEFAULT ((90)) FOR [InventoryCheckIntervalDays]
GO
ALTER TABLE [dbo].[ItAssetSettings] ADD  DEFAULT ('Daily') FOR [NotificationFrequency]
GO
ALTER TABLE [dbo].[ItAssetSettings] ADD  DEFAULT ((1)) FOR [CriticalAssetsAlertImmediately]
GO
ALTER TABLE [dbo].[ItAssetSettings] ADD  DEFAULT ((1)) FOR [EmailAlertsEnabled]
GO
ALTER TABLE [dbo].[ItAssetSettings] ADD  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[JobDesignations] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[JobDesignations] ADD  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[KnowledgeBaseDocuments] ADD  CONSTRAINT [DF_KnowledgeBaseDocuments_CreatedAt]  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[KnowledgeBaseDocuments] ADD  CONSTRAINT [DF_KnowledgeBaseDocuments_UpdatedAt]  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[LaravelSecurityIssues] ADD  DEFAULT ('Open') FOR [Status]
GO
ALTER TABLE [dbo].[LaravelSecurityIssues] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[LaravelSecurityIssues] ADD  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[LaravelSecurityProjects] ADD  DEFAULT ('Active') FOR [Status]
GO
ALTER TABLE [dbo].[LaravelSecurityProjects] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[LaravelSecurityProjects] ADD  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[LaravelSecurityRules] ADD  DEFAULT ((1)) FOR [Enabled]
GO
ALTER TABLE [dbo].[LaravelSecurityRules] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[LaravelSecurityRules] ADD  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[LaravelSecurityScanLog] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[LaravelSecurityScans] ADD  DEFAULT ('Full') FOR [ScanType]
GO
ALTER TABLE [dbo].[LaravelSecurityScans] ADD  DEFAULT ('Pending') FOR [Status]
GO
ALTER TABLE [dbo].[LaravelSecurityScans] ADD  DEFAULT ((0)) FOR [FilesScanned]
GO
ALTER TABLE [dbo].[LaravelSecurityScans] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[LaravelSecuritySettings] ADD  DEFAULT ((15)) FOR [WeightAppDebug]
GO
ALTER TABLE [dbo].[LaravelSecuritySettings] ADD  DEFAULT ((15)) FOR [WeightAppKey]
GO
ALTER TABLE [dbo].[LaravelSecuritySettings] ADD  DEFAULT ((15)) FOR [WeightDotEnv]
GO
ALTER TABLE [dbo].[LaravelSecuritySettings] ADD  DEFAULT ((15)) FOR [WeightCsrf]
GO
ALTER TABLE [dbo].[LaravelSecuritySettings] ADD  DEFAULT ((10)) FOR [WeightMassAssignment]
GO
ALTER TABLE [dbo].[LaravelSecuritySettings] ADD  DEFAULT ((10)) FOR [WeightValidation]
GO
ALTER TABLE [dbo].[LaravelSecuritySettings] ADD  DEFAULT ((10)) FOR [WeightSanitization]
GO
ALTER TABLE [dbo].[LaravelSecuritySettings] ADD  DEFAULT ((5)) FOR [WeightStorageLinks]
GO
ALTER TABLE [dbo].[LaravelSecuritySettings] ADD  DEFAULT ((5)) FOR [WeightQueue]
GO
ALTER TABLE [dbo].[LaravelSecuritySettings] ADD  DEFAULT ((2)) FOR [PointsPerIssueLow]
GO
ALTER TABLE [dbo].[LaravelSecuritySettings] ADD  DEFAULT ((5)) FOR [PointsPerIssueMedium]
GO
ALTER TABLE [dbo].[LaravelSecuritySettings] ADD  DEFAULT ((10)) FOR [PointsPerIssueHigh]
GO
ALTER TABLE [dbo].[LaravelSecuritySettings] ADD  DEFAULT ((20)) FOR [PointsPerIssueCritical]
GO
ALTER TABLE [dbo].[LaravelSecuritySettings] ADD  DEFAULT ('.php,.blade.php,.env,.env.example') FOR [AllowedExtensions]
GO
ALTER TABLE [dbo].[LaravelSecuritySettings] ADD  DEFAULT ((500)) FOR [MaxScanSizeMb]
GO
ALTER TABLE [dbo].[LaravelSecuritySettings] ADD  DEFAULT ((1800)) FOR [ScanTimeoutSeconds]
GO
ALTER TABLE [dbo].[LaravelSecuritySettings] ADD  DEFAULT ((90)) FOR [RetentionDays]
GO
ALTER TABLE [dbo].[LaravelSecuritySettings] ADD  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[LinuxFail2banJails] ADD  DEFAULT ((0)) FOR [CurrentlyBanned]
GO
ALTER TABLE [dbo].[LinuxFail2banJails] ADD  DEFAULT ((0)) FOR [TotalBanned]
GO
ALTER TABLE [dbo].[LinuxFail2banJails] ADD  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[LinuxOpenPorts] ADD  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[LinuxPermissionFindings] ADD  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[LinuxSecurityStatus] ADD  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[LinuxSudoNopasswdEntries] ADD  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[LoginActivity] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[MailBlockingPolicies] ADD  DEFAULT ((1)) FOR [Enabled]
GO
ALTER TABLE [dbo].[MailBlockingPolicies] ADD  DEFAULT ((0)) FOR [Mandatory]
GO
ALTER TABLE [dbo].[MailBlockingPolicies] ADD  DEFAULT ('Both') FOR [Direction]
GO
ALTER TABLE [dbo].[MailBlockingPolicies] ADD  DEFAULT ((100)) FOR [Priority]
GO
ALTER TABLE [dbo].[MailBlockingPolicies] ADD  DEFAULT ((1)) FOR [NotifySender]
GO
ALTER TABLE [dbo].[MailBlockingPolicies] ADD  DEFAULT ((1)) FOR [NotifyRecipient]
GO
ALTER TABLE [dbo].[MailBlockingPolicies] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[MailBlockingPolicies] ADD  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[MailIncidentAttachments] ADD  DEFAULT ((0)) FOR [Blocked]
GO
ALTER TABLE [dbo].[MailIncidentUrls] ADD  DEFAULT ((0)) FOR [Blocked]
GO
ALTER TABLE [dbo].[MailNotificationTemplates] ADD  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[MailPolicyExceptions] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[MailProviderConnections] ADD  DEFAULT ('NotConnected') FOR [Status]
GO
ALTER TABLE [dbo].[MailProviderConnections] ADD  DEFAULT ((1)) FOR [IsActive]
GO
ALTER TABLE [dbo].[MailProviderConnections] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[MailProviderConnections] ADD  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[MailSecurityIncidents] ADD  DEFAULT (newid()) FOR [IncidentId]
GO
ALTER TABLE [dbo].[MailSecurityIncidents] ADD  DEFAULT ('Simulation') FOR [Source]
GO
ALTER TABLE [dbo].[MailSecurityIncidents] ADD  DEFAULT (sysutcdatetime()) FOR [DetectedAt]
GO
ALTER TABLE [dbo].[MaintenanceLogs] ADD  DEFAULT ('Planned') FOR [Status]
GO
ALTER TABLE [dbo].[MaintenanceLogs] ADD  DEFAULT ('Medium') FOR [Priority]
GO
ALTER TABLE [dbo].[MaintenanceLogs] ADD  DEFAULT ((0)) FOR [FollowUpRequired]
GO
ALTER TABLE [dbo].[MaintenanceLogs] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[MaintenanceLogs] ADD  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[MaintenanceLogs] ADD  DEFAULT ((0)) FOR [IsDeleted]
GO
ALTER TABLE [dbo].[MaintenanceWindows] ADD  DEFAULT ((0)) FOR [IsRecurring]
GO
ALTER TABLE [dbo].[MaintenanceWindows] ADD  DEFAULT ((1)) FOR [IsActive]
GO
ALTER TABLE [dbo].[MaintenanceWindows] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[MalwareFindings] ADD  DEFAULT ('Open') FOR [Status]
GO
ALTER TABLE [dbo].[MalwareFindings] ADD  DEFAULT (sysutcdatetime()) FOR [FirstDetectedAt]
GO
ALTER TABLE [dbo].[MalwareFindings] ADD  DEFAULT (sysutcdatetime()) FOR [LastSeenAt]
GO
ALTER TABLE [dbo].[MalwareScans] ADD  DEFAULT ('Running') FOR [Status]
GO
ALTER TABLE [dbo].[MalwareScans] ADD  DEFAULT ((0)) FOR [RootsScanned]
GO
ALTER TABLE [dbo].[MalwareScans] ADD  DEFAULT ((0)) FOR [FilesScanned]
GO
ALTER TABLE [dbo].[MalwareScans] ADD  DEFAULT ((0)) FOR [FindingsCount]
GO
ALTER TABLE [dbo].[MalwareScans] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[MobileDevicePolicy] ADD  DEFAULT ((0)) FOR [AutoBlockNewMobileDevices]
GO
ALTER TABLE [dbo].[MobileDevicePolicy] ADD  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[MobileInternetControl] ADD  DEFAULT ((0)) FOR [Blocked]
GO
ALTER TABLE [dbo].[MobileInternetControl] ADD  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[MonitoringSettings] ADD  DEFAULT ((1)) FOR [Id]
GO
ALTER TABLE [dbo].[MonitoringSettings] ADD  DEFAULT ((300)) FOR [DefaultIntervalSeconds]
GO
ALTER TABLE [dbo].[MonitoringSettings] ADD  DEFAULT ((10000)) FOR [DefaultTimeoutMs]
GO
ALTER TABLE [dbo].[MonitoringSettings] ADD  DEFAULT ((2)) FOR [DefaultFailureConfirmCount]
GO
ALTER TABLE [dbo].[MonitoringSettings] ADD  DEFAULT ((1)) FOR [DefaultRecoveryConfirmCount]
GO
ALTER TABLE [dbo].[MonitoringSettings] ADD  DEFAULT ((1000)) FOR [DefaultResponseWarningMs]
GO
ALTER TABLE [dbo].[MonitoringSettings] ADD  DEFAULT ((3000)) FOR [DefaultResponseCriticalMs]
GO
ALTER TABLE [dbo].[MonitoringSettings] ADD  DEFAULT ((90)) FOR [DataRetentionDays]
GO
ALTER TABLE [dbo].[MonitoringSettings] ADD  DEFAULT ((26214400)) FOR [MaxResponseSizeBytes]
GO
ALTER TABLE [dbo].[MonitoringSettings] ADD  DEFAULT ('LogMonitor-WebsiteMonitor/1.0') FOR [DefaultUserAgent]
GO
ALTER TABLE [dbo].[MonitoringSettings] ADD  DEFAULT ((1)) FOR [BlockPrivateNetworks]
GO
ALTER TABLE [dbo].[MonitoringSettings] ADD  DEFAULT ((5)) FOR [MaxRedirects]
GO
ALTER TABLE [dbo].[MonitoringSettings] ADD  DEFAULT ((730)) FOR [AggregateRetentionDays]
GO
ALTER TABLE [dbo].[MonitorResults] ADD  DEFAULT (sysutcdatetime()) FOR [CheckedAt]
GO
ALTER TABLE [dbo].[Monitors] ADD  DEFAULT ((300)) FOR [IntervalSeconds]
GO
ALTER TABLE [dbo].[Monitors] ADD  DEFAULT ((10000)) FOR [TimeoutMs]
GO
ALTER TABLE [dbo].[Monitors] ADD  DEFAULT ((2)) FOR [FailureConfirmCount]
GO
ALTER TABLE [dbo].[Monitors] ADD  DEFAULT ((1)) FOR [RecoveryConfirmCount]
GO
ALTER TABLE [dbo].[Monitors] ADD  DEFAULT ('Pending') FOR [Status]
GO
ALTER TABLE [dbo].[Monitors] ADD  DEFAULT ((0)) FOR [ConsecutiveFailures]
GO
ALTER TABLE [dbo].[Monitors] ADD  DEFAULT ((0)) FOR [ConsecutiveSuccesses]
GO
ALTER TABLE [dbo].[Monitors] ADD  DEFAULT ((1)) FOR [IsActive]
GO
ALTER TABLE [dbo].[Monitors] ADD  DEFAULT (sysutcdatetime()) FOR [NextCheckAt]
GO
ALTER TABLE [dbo].[Monitors] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[Monitors] ADD  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[Monitors] ADD  DEFAULT ((0)) FOR [IsDeleted]
GO
ALTER TABLE [dbo].[NetworkDiagramDesigns] ADD  DEFAULT ('Draft') FOR [Status]
GO
ALTER TABLE [dbo].[NetworkDiagramDesigns] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[NetworkDiagramDesigns] ADD  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[NetworkDiagrams] ADD  DEFAULT ('Enterprise Network Topology') FOR [Name]
GO
ALTER TABLE [dbo].[NetworkDiagrams] ADD  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[NotificationLogs] ADD  DEFAULT ('Email') FOR [Provider]
GO
ALTER TABLE [dbo].[NotificationLogs] ADD  DEFAULT ('Pending') FOR [Status]
GO
ALTER TABLE [dbo].[NotificationLogs] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[NotificationLogs] ADD  DEFAULT ((0)) FOR [RetryCount]
GO
ALTER TABLE [dbo].[NotificationPreferences] ADD  DEFAULT ((1)) FOR [EmailEnabled]
GO
ALTER TABLE [dbo].[NotificationPreferences] ADD  DEFAULT ((0)) FOR [SmsEnabled]
GO
ALTER TABLE [dbo].[NotificationPreferences] ADD  DEFAULT ((0)) FOR [PushEnabled]
GO
ALTER TABLE [dbo].[NotificationPreferences] ADD  DEFAULT ((1)) FOR [InAppEnabled]
GO
ALTER TABLE [dbo].[NotificationPreferences] ADD  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[NotificationRecipients] ADD  DEFAULT ('') FOR [SubModuleKey]
GO
ALTER TABLE [dbo].[NotificationRecipients] ADD  DEFAULT ('') FOR [Recipients]
GO
ALTER TABLE [dbo].[NotificationRecipients] ADD  DEFAULT ((1)) FOR [Enabled]
GO
ALTER TABLE [dbo].[NotificationRecipients] ADD  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[NotificationRules] ADD  DEFAULT ((1)) FOR [EmailEnabled]
GO
ALTER TABLE [dbo].[NotificationRules] ADD  DEFAULT ((0)) FOR [SmsEnabled]
GO
ALTER TABLE [dbo].[NotificationRules] ADD  DEFAULT ((0)) FOR [PushEnabled]
GO
ALTER TABLE [dbo].[NotificationRules] ADD  DEFAULT ((1)) FOR [InAppEnabled]
GO
ALTER TABLE [dbo].[NotificationRules] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[NotificationRules] ADD  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[NotificationTemplates] ADD  DEFAULT ((0)) FOR [IsSystem]
GO
ALTER TABLE [dbo].[NotificationTemplates] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[NotificationTemplates] ADD  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[NvrCameras] ADD  DEFAULT ('Unknown') FOR [Status]
GO
ALTER TABLE [dbo].[NvrCameras] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[NvrCameras] ADD  DEFAULT ((0)) FOR [SortOrder]
GO
ALTER TABLE [dbo].[NvrDevices] ADD  DEFAULT ((80)) FOR [Port]
GO
ALTER TABLE [dbo].[NvrDevices] ADD  DEFAULT ('/onvif/device_service') FOR [OnvifPath]
GO
ALTER TABLE [dbo].[NvrDevices] ADD  DEFAULT ('Unknown') FOR [Status]
GO
ALTER TABLE [dbo].[NvrDevices] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[NvrDevices] ADD  DEFAULT ((554)) FOR [RtspPort]
GO
ALTER TABLE [dbo].[OffboardingActions] ADD  DEFAULT ('Skipped') FOR [GitLabStatus]
GO
ALTER TABLE [dbo].[OffboardingActions] ADD  DEFAULT ('Skipped') FOR [GlesysStatus]
GO
ALTER TABLE [dbo].[OffboardingActions] ADD  DEFAULT ('Pending') FOR [OverallStatus]
GO
ALTER TABLE [dbo].[OffboardingActions] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[OffboardingActions] ADD  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[OffboardingActions] ADD  DEFAULT ('Skipped') FOR [AgentQaStatus]
GO
ALTER TABLE [dbo].[OffboardingActions] ADD  DEFAULT ('Skipped') FOR [TeamworkStatus]
GO
ALTER TABLE [dbo].[OffboardingActions] ADD  DEFAULT (newid()) FOR [TeamworkRequestId]
GO
ALTER TABLE [dbo].[OffboardingActions] ADD  DEFAULT ('Skipped') FOR [LogMonitorStatus]
GO
ALTER TABLE [dbo].[OffboardingActions] ADD  DEFAULT ('Skipped') FOR [ActiveDirectoryStatus]
GO
ALTER TABLE [dbo].[OffboardingSettings] ADD  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[OpsAuditLog] ADD  CONSTRAINT [DF_OpsAuditLog_CreatedAt]  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[PasswordChangeLogs] ADD  DEFAULT ('NotConfigured') FOR [Status]
GO
ALTER TABLE [dbo].[PasswordChangeLogs] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[PasswordChangeLogs] ADD  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[PasswordChangeLogs] ADD  DEFAULT ((0)) FOR [IsDeleted]
GO
ALTER TABLE [dbo].[PatchUpdateLogs] ADD  DEFAULT ('Medium') FOR [Severity]
GO
ALTER TABLE [dbo].[PatchUpdateLogs] ADD  DEFAULT ('Planned') FOR [InstallationStatus]
GO
ALTER TABLE [dbo].[PatchUpdateLogs] ADD  DEFAULT ((0)) FOR [RebootRequired]
GO
ALTER TABLE [dbo].[PatchUpdateLogs] ADD  DEFAULT ((0)) FOR [RebootCompleted]
GO
ALTER TABLE [dbo].[PatchUpdateLogs] ADD  DEFAULT ('Pending') FOR [ValidationStatus]
GO
ALTER TABLE [dbo].[PatchUpdateLogs] ADD  DEFAULT ((0)) FOR [RollbackPerformed]
GO
ALTER TABLE [dbo].[PatchUpdateLogs] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[PatchUpdateLogs] ADD  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[PatchUpdateLogs] ADD  DEFAULT ((0)) FOR [IsDeleted]
GO
ALTER TABLE [dbo].[PendingEmailDigestQueue] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[PendingMalwareScanRequests] ADD  DEFAULT (sysutcdatetime()) FOR [RequestedAt]
GO
ALTER TABLE [dbo].[PendingPhpLogRequests] ADD  DEFAULT (sysutcdatetime()) FOR [RequestedAt]
GO
ALTER TABLE [dbo].[PendingPowerActionRequests] ADD  DEFAULT (sysutcdatetime()) FOR [RequestedAt]
GO
ALTER TABLE [dbo].[PendingScreenshotRequests] ADD  DEFAULT (sysutcdatetime()) FOR [RequestedAt]
GO
ALTER TABLE [dbo].[PendingUpdateRequests] ADD  CONSTRAINT [DF_PendingUpdateRequests_AllowDisruptive]  DEFAULT ((0)) FOR [AllowDisruptive]
GO
ALTER TABLE [dbo].[PendingUpdateRequests] ADD  CONSTRAINT [DF_PendingUpdateRequests_CreatedAt]  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[PendingWakeRequests] ADD  CONSTRAINT [DF_PendingWakeRequests_RequestedAt]  DEFAULT (sysutcdatetime()) FOR [RequestedAt]
GO
ALTER TABLE [dbo].[PhpLogContent] ADD  DEFAULT (sysutcdatetime()) FOR [FetchedAt]
GO
ALTER TABLE [dbo].[PhpVersions] ADD  DEFAULT ((0)) FOR [SapiCli]
GO
ALTER TABLE [dbo].[PhpVersions] ADD  DEFAULT ((0)) FOR [SapiFpm]
GO
ALTER TABLE [dbo].[PhpVersions] ADD  DEFAULT ((0)) FOR [IsDefault]
GO
ALTER TABLE [dbo].[PhpVersions] ADD  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[QaActivityLogs] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[QaAttachments] ADD  DEFAULT (sysutcdatetime()) FOR [UploadedAt]
GO
ALTER TABLE [dbo].[QaBugs] ADD  DEFAULT ('Medium') FOR [Severity]
GO
ALTER TABLE [dbo].[QaBugs] ADD  DEFAULT ('Medium') FOR [Priority]
GO
ALTER TABLE [dbo].[QaBugs] ADD  DEFAULT ('New') FOR [Status]
GO
ALTER TABLE [dbo].[QaBugs] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[QaBugs] ADD  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[QaBuilds] ADD  DEFAULT ('Pending') FOR [Status]
GO
ALTER TABLE [dbo].[QaBuilds] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[QaComments] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[QaEnvironments] ADD  DEFAULT ((1)) FOR [IsActive]
GO
ALTER TABLE [dbo].[QaEnvironments] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[QaEnvironments] ADD  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[QaMilestones] ADD  DEFAULT ('Sprint') FOR [MilestoneType]
GO
ALTER TABLE [dbo].[QaMilestones] ADD  DEFAULT ('Planned') FOR [Status]
GO
ALTER TABLE [dbo].[QaMilestones] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[QaMilestones] ADD  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[QaModules] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[QaModules] ADD  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[QaProjects] ADD  DEFAULT ((1)) FOR [IsActive]
GO
ALTER TABLE [dbo].[QaProjects] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[QaProjects] ADD  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[QaReleases] ADD  DEFAULT ('Planned') FOR [Status]
GO
ALTER TABLE [dbo].[QaReleases] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[QaRequirements] ADD  DEFAULT ('Medium') FOR [Priority]
GO
ALTER TABLE [dbo].[QaRequirements] ADD  DEFAULT ('New') FOR [Status]
GO
ALTER TABLE [dbo].[QaRequirements] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[QaRequirements] ADD  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[QaTestCases] ADD  DEFAULT ('Medium') FOR [Priority]
GO
ALTER TABLE [dbo].[QaTestCases] ADD  DEFAULT ('Functional') FOR [TestType]
GO
ALTER TABLE [dbo].[QaTestCases] ADD  DEFAULT ('Manual') FOR [AutomationStatus]
GO
ALTER TABLE [dbo].[QaTestCases] ADD  DEFAULT ('Draft') FOR [Status]
GO
ALTER TABLE [dbo].[QaTestCases] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[QaTestCases] ADD  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[QaTestExecutions] ADD  DEFAULT (sysutcdatetime()) FOR [ExecutedAt]
GO
ALTER TABLE [dbo].[QaTestPlans] ADD  DEFAULT ('Planned') FOR [Status]
GO
ALTER TABLE [dbo].[QaTestPlans] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[QaTestPlans] ADD  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[QaTestRunCases] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[QaTestRuns] ADD  DEFAULT ('Planned') FOR [Status]
GO
ALTER TABLE [dbo].[QaTestRuns] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[QaTestRuns] ADD  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[QaTestRuns] ADD  CONSTRAINT [DF_QaTestRuns_RunType]  DEFAULT ('New Feature') FOR [RunType]
GO
ALTER TABLE [dbo].[QaTestRunTypes] ADD  DEFAULT ((1)) FOR [IsActive]
GO
ALTER TABLE [dbo].[QaTestRunTypes] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[QaTestRunTypes] ADD  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[QaTestSuites] ADD  DEFAULT ('Active') FOR [Status]
GO
ALTER TABLE [dbo].[QaTestSuites] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[QaTestSuites] ADD  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[RemoteAccessSettings] ADD  DEFAULT ((1)) FOR [Id]
GO
ALTER TABLE [dbo].[RemoteAccessSettings] ADD  DEFAULT ((15)) FOR [VaultLockAfterMinutes]
GO
ALTER TABLE [dbo].[RemoteAccessSettings] ADD  DEFAULT ((15)) FOR [DefaultConnectionTimeoutSeconds]
GO
ALTER TABLE [dbo].[RemoteAccessSettings] ADD  DEFAULT ((30)) FOR [DefaultKeepaliveIntervalSeconds]
GO
ALTER TABLE [dbo].[RemoteAccessSettings] ADD  DEFAULT ((5)) FOR [ConnectionCheckIntervalMinutes]
GO
ALTER TABLE [dbo].[RemoteAccessSettings] ADD  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[RemoteAccessSettings] ADD  DEFAULT ((0)) FOR [RequireApprovalForBulkExecution]
GO
ALTER TABLE [dbo].[RemoteAccessSettings] ADD  DEFAULT ((5)) FOR [BulkExecutionApprovalThreshold]
GO
ALTER TABLE [dbo].[RemoteAccessSettings] ADD  DEFAULT ((30)) FOR [SessionIdleTimeoutMinutes]
GO
ALTER TABLE [dbo].[RemoteApprovalRequests] ADD  DEFAULT ('Pending') FOR [Status]
GO
ALTER TABLE [dbo].[RemoteApprovalRequests] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[RemoteAuditLog] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[RemoteCertificates] ADD  DEFAULT ((0)) FOR [IsTrusted]
GO
ALTER TABLE [dbo].[RemoteCertificates] ADD  DEFAULT (sysutcdatetime()) FOR [FirstSeenAt]
GO
ALTER TABLE [dbo].[RemoteCertificates] ADD  DEFAULT (sysutcdatetime()) FOR [LastSeenAt]
GO
ALTER TABLE [dbo].[RemoteCertificates] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[RemoteCertificates] ADD  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[RemoteCertificates] ADD  DEFAULT ((1)) FOR [IsActive]
GO
ALTER TABLE [dbo].[RemoteCertificates] ADD  DEFAULT ((0)) FOR [IsDeleted]
GO
ALTER TABLE [dbo].[RemoteConnectionChecks] ADD  DEFAULT (sysutcdatetime()) FOR [CheckedAt]
GO
ALTER TABLE [dbo].[RemoteConnectionGroups] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[RemoteConnectionGroups] ADD  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[RemoteConnectionGroups] ADD  DEFAULT ((1)) FOR [IsActive]
GO
ALTER TABLE [dbo].[RemoteConnectionGroups] ADD  DEFAULT ((0)) FOR [IsDeleted]
GO
ALTER TABLE [dbo].[RemoteConnections] ADD  DEFAULT ('Production') FOR [Environment]
GO
ALTER TABLE [dbo].[RemoteConnections] ADD  DEFAULT ((0)) FOR [IsFavorite]
GO
ALTER TABLE [dbo].[RemoteConnections] ADD  DEFAULT ((15)) FOR [ConnectionTimeoutSeconds]
GO
ALTER TABLE [dbo].[RemoteConnections] ADD  DEFAULT ((30)) FOR [KeepaliveIntervalSeconds]
GO
ALTER TABLE [dbo].[RemoteConnections] ADD  DEFAULT ((0)) FOR [AutoReconnect]
GO
ALTER TABLE [dbo].[RemoteConnections] ADD  DEFAULT ('Unknown') FOR [AvailabilityStatus]
GO
ALTER TABLE [dbo].[RemoteConnections] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[RemoteConnections] ADD  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[RemoteConnections] ADD  DEFAULT ((1)) FOR [IsActive]
GO
ALTER TABLE [dbo].[RemoteConnections] ADD  DEFAULT ((0)) FOR [IsDeleted]
GO
ALTER TABLE [dbo].[RemoteConnections] ADD  DEFAULT ((1)) FOR [IsShared]
GO
ALTER TABLE [dbo].[RemoteCredentials] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[RemoteCredentials] ADD  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[RemoteCredentials] ADD  DEFAULT ((1)) FOR [IsActive]
GO
ALTER TABLE [dbo].[RemoteCredentials] ADD  DEFAULT ((0)) FOR [IsDeleted]
GO
ALTER TABLE [dbo].[RemoteFileTransfers] ADD  DEFAULT ('Completed') FOR [Status]
GO
ALTER TABLE [dbo].[RemoteFileTransfers] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[RemoteFileTransfers] ADD  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[RemoteFileTransfers] ADD  DEFAULT ((1)) FOR [IsActive]
GO
ALTER TABLE [dbo].[RemoteFileTransfers] ADD  DEFAULT ((0)) FOR [IsDeleted]
GO
ALTER TABLE [dbo].[RemoteInventoryDevices] ADD  DEFAULT ('Unknown') FOR [AvailabilityStatus]
GO
ALTER TABLE [dbo].[RemoteInventoryDevices] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[RemoteInventoryDevices] ADD  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[RemoteInventoryDevices] ADD  DEFAULT ((1)) FOR [IsActive]
GO
ALTER TABLE [dbo].[RemoteInventoryDevices] ADD  DEFAULT ((0)) FOR [IsDeleted]
GO
ALTER TABLE [dbo].[RemotePortForwards] ADD  DEFAULT ('Stopped') FOR [Status]
GO
ALTER TABLE [dbo].[RemotePortForwards] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[RemotePortForwards] ADD  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[RemotePortForwards] ADD  DEFAULT ((1)) FOR [IsActive]
GO
ALTER TABLE [dbo].[RemotePortForwards] ADD  DEFAULT ((0)) FOR [IsDeleted]
GO
ALTER TABLE [dbo].[RemoteProtocolDiagnostics] ADD  DEFAULT ('SCTP') FOR [Protocol]
GO
ALTER TABLE [dbo].[RemoteProtocolDiagnostics] ADD  DEFAULT (sysutcdatetime()) FOR [RanAt]
GO
ALTER TABLE [dbo].[RemoteScriptExecutions] ADD  DEFAULT (sysutcdatetime()) FOR [StartedAt]
GO
ALTER TABLE [dbo].[RemoteScriptExecutions] ADD  DEFAULT ('Running') FOR [Status]
GO
ALTER TABLE [dbo].[RemoteScriptExecutions] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[RemoteScriptExecutions] ADD  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[RemoteScriptExecutions] ADD  DEFAULT ((1)) FOR [IsActive]
GO
ALTER TABLE [dbo].[RemoteScriptExecutions] ADD  DEFAULT ((0)) FOR [IsDeleted]
GO
ALTER TABLE [dbo].[RemoteScripts] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[RemoteScripts] ADD  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[RemoteScripts] ADD  DEFAULT ((1)) FOR [IsActive]
GO
ALTER TABLE [dbo].[RemoteScripts] ADD  DEFAULT ((0)) FOR [IsDeleted]
GO
ALTER TABLE [dbo].[RemoteSessionEvents] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[RemoteSessionFileTransfers] ADD  DEFAULT ('PendingApproval') FOR [Status]
GO
ALTER TABLE [dbo].[RemoteSessionFileTransfers] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[RemoteSessionLogs] ADD  DEFAULT (sysutcdatetime()) FOR [LoggedAt]
GO
ALTER TABLE [dbo].[RemoteSessions] ADD  DEFAULT ((0)) FOR [IsAdHoc]
GO
ALTER TABLE [dbo].[RemoteSessions] ADD  DEFAULT (sysutcdatetime()) FOR [StartedAt]
GO
ALTER TABLE [dbo].[RemoteSessions] ADD  DEFAULT ('Active') FOR [Status]
GO
ALTER TABLE [dbo].[RemoteSessions] ADD  DEFAULT ('NotRecorded') FOR [RecordingStatus]
GO
ALTER TABLE [dbo].[RemoteSessions] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[RemoteSessions] ADD  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[RemoteSessions] ADD  DEFAULT ((1)) FOR [IsActive]
GO
ALTER TABLE [dbo].[RemoteSessions] ADD  DEFAULT ((0)) FOR [IsDeleted]
GO
ALTER TABLE [dbo].[RemoteSessionSignaling] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[RemoteSSHKeys] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[RemoteSSHKeys] ADD  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[RemoteSSHKeys] ADD  DEFAULT ((1)) FOR [IsActive]
GO
ALTER TABLE [dbo].[RemoteSSHKeys] ADD  DEFAULT ((0)) FOR [IsDeleted]
GO
ALTER TABLE [dbo].[RemoteSupportSessions] ADD  DEFAULT (newid()) FOR [SessionGuid]
GO
ALTER TABLE [dbo].[RemoteSupportSessions] ADD  DEFAULT ('Pending') FOR [Status]
GO
ALTER TABLE [dbo].[RemoteSupportSessions] ADD  DEFAULT (sysutcdatetime()) FOR [RequestedAt]
GO
ALTER TABLE [dbo].[RemoteSupportSessions] ADD  DEFAULT ('view') FOR [PermissionsGranted]
GO
ALTER TABLE [dbo].[RemoteSupportSessions] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[RepoConnections] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[RepoConnections] ADD  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[RolePermissions] ADD  DEFAULT ((0)) FOR [Allowed]
GO
ALTER TABLE [dbo].[Roles] ADD  DEFAULT ((0)) FOR [IsSystem]
GO
ALTER TABLE [dbo].[Roles] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[Roles] ADD  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[RouterActiveUsers] ADD  DEFAULT (sysutcdatetime()) FOR [ReceivedAt]
GO
ALTER TABLE [dbo].[RouterBandwidth] ADD  DEFAULT (sysutcdatetime()) FOR [ReceivedAt]
GO
ALTER TABLE [dbo].[RouterClients] ADD  DEFAULT (sysutcdatetime()) FOR [FirstSeenAt]
GO
ALTER TABLE [dbo].[RouterClients] ADD  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[RouterClientTraffic] ADD  DEFAULT (sysutcdatetime()) FOR [ReceivedAt]
GO
ALTER TABLE [dbo].[RouterHealth] ADD  DEFAULT (sysutcdatetime()) FOR [ReceivedAt]
GO
ALTER TABLE [dbo].[RouterInterfaces] ADD  DEFAULT ((0)) FOR [Running]
GO
ALTER TABLE [dbo].[RouterInterfaces] ADD  DEFAULT ((0)) FOR [Disabled]
GO
ALTER TABLE [dbo].[RouterInterfaces] ADD  DEFAULT ((0)) FOR [Slave]
GO
ALTER TABLE [dbo].[RouterInterfaces] ADD  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[RouterWebLogs] ADD  DEFAULT (sysutcdatetime()) FOR [ReceivedAt]
GO
ALTER TABLE [dbo].[ScheduledReports] ADD  DEFAULT ('Weekly') FOR [Frequency]
GO
ALTER TABLE [dbo].[ScheduledReports] ADD  DEFAULT ('Email') FOR [Format]
GO
ALTER TABLE [dbo].[ScheduledReports] ADD  DEFAULT ('All') FOR [MonitorScope]
GO
ALTER TABLE [dbo].[ScheduledReports] ADD  DEFAULT ((1)) FOR [IsActive]
GO
ALTER TABLE [dbo].[ScheduledReports] ADD  DEFAULT (sysutcdatetime()) FOR [NextSendAt]
GO
ALTER TABLE [dbo].[ScheduledReports] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[ScreenshotAuditLog] ADD  DEFAULT (sysutcdatetime()) FOR [ActionAt]
GO
ALTER TABLE [dbo].[Screenshots] ADD  DEFAULT (sysutcdatetime()) FOR [UploadedAt]
GO
ALTER TABLE [dbo].[Screenshots] ADD  CONSTRAINT [DF_Screenshots_Format]  DEFAULT ('png') FOR [Format]
GO
ALTER TABLE [dbo].[SecurityAlertNotes] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[SecurityAlerts] ADD  DEFAULT ('New') FOR [Status]
GO
ALTER TABLE [dbo].[SecurityAlerts] ADD  DEFAULT (sysutcdatetime()) FOR [FirstSeenAt]
GO
ALTER TABLE [dbo].[SecurityAlerts] ADD  DEFAULT (sysutcdatetime()) FOR [LastSeenAt]
GO
ALTER TABLE [dbo].[SecurityAlerts] ADD  DEFAULT ((1)) FOR [OccurrenceCount]
GO
ALTER TABLE [dbo].[SecurityAlerts] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[SecurityAlerts] ADD  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[SecurityAlertStatusHistory] ADD  DEFAULT (sysutcdatetime()) FOR [ChangedAt]
GO
ALTER TABLE [dbo].[SecurityCenterScoreSnapshots] ADD  DEFAULT (sysutcdatetime()) FOR [SnapshotAt]
GO
ALTER TABLE [dbo].[SecurityCollectorHealth] ADD  DEFAULT (sysutcdatetime()) FOR [CheckedAt]
GO
ALTER TABLE [dbo].[SecurityCollectorHealth] ADD  DEFAULT ((0)) FOR [EventsProcessedLastRun]
GO
ALTER TABLE [dbo].[SecurityDetectionRules] ADD  DEFAULT ((1)) FOR [Enabled]
GO
ALTER TABLE [dbo].[SecurityDetectionRules] ADD  DEFAULT ('[]') FOR [ExclusionsJson]
GO
ALTER TABLE [dbo].[SecurityDetectionRules] ADD  DEFAULT ((1)) FOR [ThresholdCount]
GO
ALTER TABLE [dbo].[SecurityDetectionRules] ADD  DEFAULT ((60)) FOR [ThresholdWindowSeconds]
GO
ALTER TABLE [dbo].[SecurityDetectionRules] ADD  DEFAULT ('{ruleKey}:{sourceIp}') FOR [GroupingKeyTemplate]
GO
ALTER TABLE [dbo].[SecurityDetectionRules] ADD  DEFAULT ((300)) FOR [CooldownSeconds]
GO
ALTER TABLE [dbo].[SecurityDetectionRules] ADD  DEFAULT ((1)) FOR [Version]
GO
ALTER TABLE [dbo].[SecurityDetectionRules] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[SecurityDetectionRules] ADD  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[SecurityEvents] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[SecurityFileIntegrityBaselines] ADD  DEFAULT (sysutcdatetime()) FOR [LastVerifiedAt]
GO
ALTER TABLE [dbo].[SecurityFileIntegrityBaselines] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[SecurityFileIntegrityEvents] ADD  DEFAULT (sysutcdatetime()) FOR [DetectedAt]
GO
ALTER TABLE [dbo].[SecurityFileIntegrityEvents] ADD  DEFAULT ((0)) FOR [Acknowledged]
GO
ALTER TABLE [dbo].[SecurityHeaderScans] ADD  DEFAULT (sysutcdatetime()) FOR [ScannedAt]
GO
ALTER TABLE [dbo].[SecurityIncidents] ADD  CONSTRAINT [DF_SecurityIncidents_Severity]  DEFAULT ('medium') FOR [Severity]
GO
ALTER TABLE [dbo].[SecurityIncidents] ADD  CONSTRAINT [DF_SecurityIncidents_Status]  DEFAULT ('Open') FOR [Status]
GO
ALTER TABLE [dbo].[SecurityIncidents] ADD  CONSTRAINT [DF_SecurityIncidents_CreatedAt]  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[SecurityIncidents] ADD  CONSTRAINT [DF_SecurityIncidents_UpdatedAt]  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[SecurityIpAllowlist] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[SecurityIpBlocklist] ADD  DEFAULT ('Manual') FOR [Source]
GO
ALTER TABLE [dbo].[SecurityIpBlocklist] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[SecurityIpBlocklist] ADD  DEFAULT ((1)) FOR [IsActive]
GO
ALTER TABLE [dbo].[SecurityIpProfiles] ADD  DEFAULT (sysutcdatetime()) FOR [FirstSeenAt]
GO
ALTER TABLE [dbo].[SecurityIpProfiles] ADD  DEFAULT (sysutcdatetime()) FOR [LastSeenAt]
GO
ALTER TABLE [dbo].[SecurityIpProfiles] ADD  DEFAULT ((0)) FOR [TotalEvents]
GO
ALTER TABLE [dbo].[SecurityIpProfiles] ADD  DEFAULT ((0)) FOR [TotalAlerts]
GO
ALTER TABLE [dbo].[SecurityIpProfiles] ADD  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[SecurityLogSources] ADD  DEFAULT ((1)) FOR [Enabled]
GO
ALTER TABLE [dbo].[SecurityLogSources] ADD  DEFAULT ('{}') FOR [ConfigJson]
GO
ALTER TABLE [dbo].[SecurityLogSources] ADD  DEFAULT ((0)) FOR [LastPosition]
GO
ALTER TABLE [dbo].[SecurityLogSources] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[SecurityLogSources] ADD  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[SecurityNotificationChannels] ADD  DEFAULT ((1)) FOR [Enabled]
GO
ALTER TABLE [dbo].[SecurityNotificationChannels] ADD  DEFAULT ('high') FOR [MinSeverity]
GO
ALTER TABLE [dbo].[SecurityNotificationChannels] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[SecurityNotificationDeliveries] ADD  DEFAULT ((1)) FOR [AttemptCount]
GO
ALTER TABLE [dbo].[SecurityNotificationDeliveries] ADD  DEFAULT (sysutcdatetime()) FOR [SentAt]
GO
ALTER TABLE [dbo].[SecurityProtectedApplications] ADD  DEFAULT ((1)) FOR [IsActive]
GO
ALTER TABLE [dbo].[SecurityProtectedApplications] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[SecurityResponseActions] ADD  DEFAULT ('Pending') FOR [Status]
GO
ALTER TABLE [dbo].[SecurityResponseActions] ADD  DEFAULT ((1)) FOR [DryRun]
GO
ALTER TABLE [dbo].[SecurityResponseActions] ADD  DEFAULT (sysutcdatetime()) FOR [RequestedAt]
GO
ALTER TABLE [dbo].[SecurityRetentionSettings] ADD  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[SecurityRuleExclusions] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[SecuritySettings] ADD  DEFAULT ((8)) FOR [PasswordMinLength]
GO
ALTER TABLE [dbo].[SecuritySettings] ADD  DEFAULT ((1)) FOR [PasswordRequireUppercase]
GO
ALTER TABLE [dbo].[SecuritySettings] ADD  DEFAULT ((1)) FOR [PasswordRequireNumber]
GO
ALTER TABLE [dbo].[SecuritySettings] ADD  DEFAULT ((0)) FOR [PasswordRequireSymbol]
GO
ALTER TABLE [dbo].[SecuritySettings] ADD  DEFAULT ((0)) FOR [SsoEnabled]
GO
ALTER TABLE [dbo].[SecuritySettings] ADD  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[SecurityUserRoles] ADD  DEFAULT (sysutcdatetime()) FOR [GrantedAt]
GO
ALTER TABLE [dbo].[SeoScans] ADD  DEFAULT (sysutcdatetime()) FOR [ScannedAt]
GO
ALTER TABLE [dbo].[ServerLogEntries] ADD  DEFAULT (sysutcdatetime()) FOR [ReceivedAt]
GO
ALTER TABLE [dbo].[ServerRoomEntries] ADD  CONSTRAINT [DF_ServerRoomEntries_EntryAt]  DEFAULT (sysutcdatetime()) FOR [EntryAt]
GO
ALTER TABLE [dbo].[ServerRoomEntries] ADD  CONSTRAINT [DF_ServerRoomEntries_CreatedAt]  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[ServerRoomTasks] ADD  CONSTRAINT [DF_ServerRoomTasks_StartAt]  DEFAULT (sysutcdatetime()) FOR [StartAt]
GO
ALTER TABLE [dbo].[ServerRoomTasks] ADD  CONSTRAINT [DF_ServerRoomTasks_Status]  DEFAULT ('In Progress') FOR [Status]
GO
ALTER TABLE [dbo].[ServerRoomTasks] ADD  CONSTRAINT [DF_ServerRoomTasks_CreatedAt]  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[SlaConfigurations] ADD  DEFAULT ((99.9)) FOR [TargetPercent]
GO
ALTER TABLE [dbo].[SlaConfigurations] ADD  DEFAULT ('Monthly') FOR [EvaluationWindow]
GO
ALTER TABLE [dbo].[SliderImages] ADD  DEFAULT ((0)) FOR [SortOrder]
GO
ALTER TABLE [dbo].[SliderImages] ADD  DEFAULT ((1)) FOR [Enabled]
GO
ALTER TABLE [dbo].[SliderImages] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[SliderImages] ADD  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[SmtpSettings] ADD  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[SoftwareInventory] ADD  DEFAULT ('PendingApproval') FOR [ApprovalStatus]
GO
ALTER TABLE [dbo].[SoftwareInventory] ADD  DEFAULT ('Installed') FOR [SoftwareStatus]
GO
ALTER TABLE [dbo].[SoftwareInventory] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[SoftwareInventory] ADD  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[SoftwareInventory] ADD  DEFAULT ((0)) FOR [IsDeleted]
GO
ALTER TABLE [dbo].[SophosClients] ADD  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[SophosEventLogs] ADD  DEFAULT (sysutcdatetime()) FOR [ReceivedAt]
GO
ALTER TABLE [dbo].[SophosThreatLogs] ADD  DEFAULT (sysutcdatetime()) FOR [ReceivedAt]
GO
ALTER TABLE [dbo].[SpeedTestResults] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[SqlServerActiveSessions] ADD  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[SqlServerBlockingEvents] ADD  DEFAULT (sysutcdatetime()) FOR [DetectedAt]
GO
ALTER TABLE [dbo].[SqlServerDatabaseSnapshots] ADD  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[SqlServerDeadlockEvents] ADD  DEFAULT (sysutcdatetime()) FOR [ReceivedAt]
GO
ALTER TABLE [dbo].[SqlServerInstances] ADD  DEFAULT ((1433)) FOR [Port]
GO
ALTER TABLE [dbo].[SqlServerInstances] ADD  DEFAULT ('sql') FOR [AuthType]
GO
ALTER TABLE [dbo].[SqlServerInstances] ADD  DEFAULT ((0)) FOR [IsSelfMonitoring]
GO
ALTER TABLE [dbo].[SqlServerInstances] ADD  DEFAULT ((1)) FOR [Enabled]
GO
ALTER TABLE [dbo].[SqlServerInstances] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[SqlServerInstances] ADD  DEFAULT ('mssql') FOR [Engine]
GO
ALTER TABLE [dbo].[SqlServerMetricsSnapshots] ADD  DEFAULT (sysutcdatetime()) FOR [ReceivedAt]
GO
ALTER TABLE [dbo].[SqlServerSlowQueries] ADD  DEFAULT (sysutcdatetime()) FOR [DetectedAt]
GO
ALTER TABLE [dbo].[SqlServerSlowQueries] ADD  DEFAULT ('duration') FOR [RankBy]
GO
ALTER TABLE [dbo].[Staff] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[Staff] ADD  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[Staff] ADD  CONSTRAINT [DF_Staff_AdDisabled]  DEFAULT ((0)) FOR [AdDisabled]
GO
ALTER TABLE [dbo].[Staff] ADD  CONSTRAINT [DF_Staff_EmploymentStatus]  DEFAULT ('Active') FOR [EmploymentStatus]
GO
ALTER TABLE [dbo].[SupportTicketNotes] ADD  DEFAULT ((0)) FOR [IsInternal]
GO
ALTER TABLE [dbo].[SupportTicketNotes] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[SupportTickets] ADD  DEFAULT ('open') FOR [Status]
GO
ALTER TABLE [dbo].[SupportTickets] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[SupportTickets] ADD  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[SystemHealthLogs] ADD  DEFAULT (sysutcdatetime()) FOR [ReceivedAt]
GO
ALTER TABLE [dbo].[Teams] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[Teams] ADD  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[ThreatScans] ADD  DEFAULT ('Pending') FOR [Status]
GO
ALTER TABLE [dbo].[ThreatScans] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[UpdateHistory] ADD  CONSTRAINT [DF_UpdateHistory_CreatedAt]  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[UpdateInstallResults] ADD  CONSTRAINT [DF_UpdateInstallResults_CreatedAt]  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[UpdateSchedules] ADD  CONSTRAINT [DF_UpdateSchedules_IncludeDisruptive]  DEFAULT ((0)) FOR [IncludeDisruptive]
GO
ALTER TABLE [dbo].[UpdateSchedules] ADD  CONSTRAINT [DF_UpdateSchedules_IsActive]  DEFAULT ((1)) FOR [IsActive]
GO
ALTER TABLE [dbo].[UpdateSchedules] ADD  CONSTRAINT [DF_UpdateSchedules_IsDeleted]  DEFAULT ((0)) FOR [IsDeleted]
GO
ALTER TABLE [dbo].[UpdateSchedules] ADD  CONSTRAINT [DF_UpdateSchedules_CreatedAt]  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[UsbDevicePolicies] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[UsbDevicePolicies] ADD  DEFAULT ((1)) FOR [IsActive]
GO
ALTER TABLE [dbo].[UserGroups] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[UserGroups] ADD  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[UserPasskeys] ADD  DEFAULT ((0)) FOR [Counter]
GO
ALTER TABLE [dbo].[UserPasskeys] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[Users] ADD  DEFAULT ('Admin') FOR [Role]
GO
ALTER TABLE [dbo].[Users] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[Users] ADD  DEFAULT ((1)) FOR [IsActive]
GO
ALTER TABLE [dbo].[Users] ADD  DEFAULT ((0)) FOR [MfaRequired]
GO
ALTER TABLE [dbo].[Users] ADD  DEFAULT ((0)) FOR [PendingOtpAttempts]
GO
ALTER TABLE [dbo].[Users] ADD  DEFAULT ((0)) FOR [SkipPasswordWhenPossible]
GO
ALTER TABLE [dbo].[Users] ADD  DEFAULT ((0)) FOR [TotpEnabled]
GO
ALTER TABLE [dbo].[Users] ADD  DEFAULT ((0)) FOR [MustChangePassword]
GO
ALTER TABLE [dbo].[Users] ADD  DEFAULT ((0)) FOR [FailedLoginAttempts]
GO
ALTER TABLE [dbo].[UserTotpRecoveryCodes] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[VulnerabilityFindings] ADD  DEFAULT ('Open') FOR [Status]
GO
ALTER TABLE [dbo].[VulnerabilityFindings] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[VulnerabilityFindings] ADD  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[VulnerabilityScans] ADD  DEFAULT ((0)) FOR [IsAdHocTarget]
GO
ALTER TABLE [dbo].[VulnerabilityScans] ADD  DEFAULT ('Pending') FOR [Status]
GO
ALTER TABLE [dbo].[VulnerabilityScans] ADD  DEFAULT ((0)) FOR [ChecksRun]
GO
ALTER TABLE [dbo].[VulnerabilityScans] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[VulnerabilityScans] ADD  DEFAULT ('Website') FOR [ScanType]
GO
ALTER TABLE [dbo].[WacCriticalAllowlist] ADD  DEFAULT ('suffix') FOR [MatchType]
GO
ALTER TABLE [dbo].[WacCriticalAllowlist] ADD  DEFAULT ((1)) FOR [IsCritical]
GO
ALTER TABLE [dbo].[WacCriticalAllowlist] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[WacCriticalAllowlist] ADD  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[WacGroups] ADD  DEFAULT ((0)) FOR [IsBuiltIn]
GO
ALTER TABLE [dbo].[WacGroups] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[WacGroups] ADD  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[WacSchedules] ADD  DEFAULT ((0)) FOR [IsBuiltIn]
GO
ALTER TABLE [dbo].[WacSchedules] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[WacSyncStatus] ADD  DEFAULT ('NotConnected') FOR [Status]
GO
ALTER TABLE [dbo].[WacWebsiteRules] ADD  DEFAULT ('suffix') FOR [MatchType]
GO
ALTER TABLE [dbo].[WacWebsiteRules] ADD  DEFAULT ('Normal') FOR [Priority]
GO
ALTER TABLE [dbo].[WacWebsiteRules] ADD  DEFAULT ('Enabled') FOR [Status]
GO
ALTER TABLE [dbo].[WacWebsiteRules] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[WacWebsiteRules] ADD  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[WafApplications] ADD  DEFAULT ((443)) FOR [OriginPort]
GO
ALTER TABLE [dbo].[WafApplications] ADD  DEFAULT ((1)) FOR [HttpsEnabled]
GO
ALTER TABLE [dbo].[WafApplications] ADD  DEFAULT ('Enabled') FOR [Status]
GO
ALTER TABLE [dbo].[WafApplications] ADD  DEFAULT ('Monitoring') FOR [WafMode]
GO
ALTER TABLE [dbo].[WafApplications] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[WafApplications] ADD  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[WafAttackEvents] ADD  DEFAULT (sysutcdatetime()) FOR [EventTimestamp]
GO
ALTER TABLE [dbo].[WafAttackEvents] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[WafCertificates] ADD  DEFAULT ('Unknown') FOR [Status]
GO
ALTER TABLE [dbo].[WafCertificates] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[WafCertificates] ADD  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[WafCountryRules] ADD  DEFAULT ('Block') FOR [Action]
GO
ALTER TABLE [dbo].[WafCountryRules] ADD  DEFAULT ((1)) FOR [IsActive]
GO
ALTER TABLE [dbo].[WafCountryRules] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[WafCustomRules] ADD  DEFAULT ('LogOnly') FOR [Action]
GO
ALTER TABLE [dbo].[WafCustomRules] ADD  DEFAULT ((1)) FOR [IsActive]
GO
ALTER TABLE [dbo].[WafCustomRules] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[WafHealthChecks] ADD  DEFAULT (sysutcdatetime()) FOR [CheckedAt]
GO
ALTER TABLE [dbo].[WafIpRules] ADD  DEFAULT ((0)) FOR [IsTemporary]
GO
ALTER TABLE [dbo].[WafIpRules] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[WafRateLimitRules] ADD  DEFAULT ('LogOnly') FOR [Action]
GO
ALTER TABLE [dbo].[WafRateLimitRules] ADD  DEFAULT ((1)) FOR [IsActive]
GO
ALTER TABLE [dbo].[WafRateLimitRules] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[WafRateLimits] ADD  DEFAULT ('Block') FOR [Action]
GO
ALTER TABLE [dbo].[WafRateLimits] ADD  DEFAULT ((1)) FOR [Enabled]
GO
ALTER TABLE [dbo].[WafRateLimits] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[WafRateLimits] ADD  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[WafRequestLogs] ADD  DEFAULT (sysutcdatetime()) FOR [EventTimestamp]
GO
ALTER TABLE [dbo].[WafRequestLogs] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[WafRuleExceptions] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[WafRules] ADD  DEFAULT ((1)) FOR [Enabled]
GO
ALTER TABLE [dbo].[WafRules] ADD  DEFAULT ('Global') FOR [Mode]
GO
ALTER TABLE [dbo].[WafRules] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[WafRules] ADD  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[WafSettings] ADD  DEFAULT ((1)) FOR [Id]
GO
ALTER TABLE [dbo].[WafSettings] ADD  DEFAULT ((365)) FOR [AttackEventRetentionDays]
GO
ALTER TABLE [dbo].[WafSettings] ADD  DEFAULT ((30)) FOR [RequestLogRetentionDays]
GO
ALTER TABLE [dbo].[WafSettings] ADD  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[WatchedFiles] ADD  DEFAULT ((1)) FOR [Enabled]
GO
ALTER TABLE [dbo].[WatchedFiles] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[WazuhOfficeAgentVulnerabilities] ADD  DEFAULT ('Open') FOR [Status]
GO
ALTER TABLE [dbo].[WazuhOfficeAgentVulnerabilities] ADD  DEFAULT (sysutcdatetime()) FOR [DetectedAt]
GO
ALTER TABLE [dbo].[WazuhOfficeAlertComments] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[WazuhOfficeAlerts] ADD  DEFAULT (sysutcdatetime()) FOR [TriggeredAt]
GO
ALTER TABLE [dbo].[WazuhOfficeAlerts] ADD  DEFAULT ('New') FOR [Status]
GO
ALTER TABLE [dbo].[WazuhOfficeAlerts] ADD  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[WazuhOfficeCpuMetrics] ADD  DEFAULT (sysutcdatetime()) FOR [CapturedAt]
GO
ALTER TABLE [dbo].[WazuhOfficeDiskMetrics] ADD  DEFAULT (sysutcdatetime()) FOR [CapturedAt]
GO
ALTER TABLE [dbo].[WazuhOfficeFileIntegrityEvents] ADD  DEFAULT (sysutcdatetime()) FOR [DetectedAt]
GO
ALTER TABLE [dbo].[WazuhOfficeInventorySnapshots] ADD  DEFAULT (sysutcdatetime()) FOR [CapturedAt]
GO
ALTER TABLE [dbo].[WazuhOfficeMemoryMetrics] ADD  DEFAULT (sysutcdatetime()) FOR [CapturedAt]
GO
ALTER TABLE [dbo].[WazuhOfficeNetworkConnections] ADD  DEFAULT (sysutcdatetime()) FOR [CapturedAt]
GO
ALTER TABLE [dbo].[WazuhOfficeProcesses] ADD  DEFAULT (sysutcdatetime()) FOR [CapturedAt]
GO
ALTER TABLE [dbo].[WazuhOfficeRules] ADD  DEFAULT ((1)) FOR [Enabled]
GO
ALTER TABLE [dbo].[WazuhOfficeRules] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[WazuhOfficeRules] ADD  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[WazuhOfficeSecurityEvents] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[WazuhOfficeServices] ADD  DEFAULT (sysutcdatetime()) FOR [CapturedAt]
GO
ALTER TABLE [dbo].[WazuhOfficeSettings] ADD  DEFAULT ((1)) FOR [Id]
GO
ALTER TABLE [dbo].[WazuhOfficeSettings] ADD  DEFAULT ((90)) FOR [SecurityEventRetentionDays]
GO
ALTER TABLE [dbo].[WazuhOfficeSettings] ADD  DEFAULT ((365)) FOR [AlertRetentionDays]
GO
ALTER TABLE [dbo].[WazuhOfficeSettings] ADD  DEFAULT ((90)) FOR [MetricRetentionDays]
GO
ALTER TABLE [dbo].[WazuhOfficeSettings] ADD  DEFAULT ((90)) FOR [CpuHighThresholdPercent]
GO
ALTER TABLE [dbo].[WazuhOfficeSettings] ADD  DEFAULT ((90)) FOR [MemoryHighThresholdPercent]
GO
ALTER TABLE [dbo].[WazuhOfficeSettings] ADD  DEFAULT ((85)) FOR [DiskHighThresholdPercent]
GO
ALTER TABLE [dbo].[WazuhOfficeSettings] ADD  DEFAULT ((25)) FOR [TempWarningC]
GO
ALTER TABLE [dbo].[WazuhOfficeSettings] ADD  DEFAULT ((30)) FOR [TempHighC]
GO
ALTER TABLE [dbo].[WazuhOfficeSettings] ADD  DEFAULT ((35)) FOR [TempCriticalC]
GO
ALTER TABLE [dbo].[WazuhOfficeSettings] ADD  DEFAULT ((38)) FOR [TempEmergencyC]
GO
ALTER TABLE [dbo].[WazuhOfficeSettings] ADD  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[WazuhOfficeTemperatureMetrics] ADD  DEFAULT (sysutcdatetime()) FOR [CapturedAt]
GO
ALTER TABLE [dbo].[WazuhOfficeVulnerabilities] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[WazuhOfficeWatchedPaths] ADD  DEFAULT ((1)) FOR [Enabled]
GO
ALTER TABLE [dbo].[WazuhOfficeWatchedPaths] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[WebFilterLogs] ADD  DEFAULT (sysutcdatetime()) FOR [ReceivedAt]
GO
ALTER TABLE [dbo].[WebhookSettings] ADD  DEFAULT ('slack') FOR [Platform]
GO
ALTER TABLE [dbo].[WebhookSettings] ADD  DEFAULT ((0)) FOR [Enabled]
GO
ALTER TABLE [dbo].[WebhookSettings] ADD  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[WebsiteAuditActivityLogs] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[WebsiteAuditEmailLogs] ADD  DEFAULT (sysutcdatetime()) FOR [SentAt]
GO
ALTER TABLE [dbo].[WebsiteAuditReports] ADD  DEFAULT (sysutcdatetime()) FOR [GeneratedAt]
GO
ALTER TABLE [dbo].[WebsiteAuditScanLog] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[WebsiteAuditScans] ADD  DEFAULT (sysutcdatetime()) FOR [StartedAt]
GO
ALTER TABLE [dbo].[WebsiteAuditScans] ADD  DEFAULT ('Pending') FOR [Status]
GO
ALTER TABLE [dbo].[WebsiteAuditScans] ADD  DEFAULT ('admin') FOR [TriggeredBy]
GO
ALTER TABLE [dbo].[WebsiteAuditScans] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[WebsiteAuditSourceInputs] ADD  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[WebsiteIncidentReports] ADD  DEFAULT ('Medium') FOR [Severity]
GO
ALTER TABLE [dbo].[WebsiteIncidentReports] ADD  DEFAULT ('neutral') FOR [StatusTone]
GO
ALTER TABLE [dbo].[WebsiteIncidentReports] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[WebsiteIncidentReports] ADD  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[WebsiteMonitorConfigs] ADD  DEFAULT ('GET') FOR [HttpMethod]
GO
ALTER TABLE [dbo].[WebsiteMonitorConfigs] ADD  DEFAULT ((200)) FOR [ExpectedStatusCode]
GO
ALTER TABLE [dbo].[WebsiteMonitorConfigs] ADD  DEFAULT ((1)) FOR [FollowRedirects]
GO
ALTER TABLE [dbo].[WebsiteMonitorConfigs] ADD  DEFAULT ((5)) FOR [MaxRedirects]
GO
ALTER TABLE [dbo].[WebsiteMonitorConfigs] ADD  DEFAULT ((1)) FOR [SslVerify]
GO
ALTER TABLE [dbo].[WebsiteMonitorConfigs] ADD  DEFAULT ((1000)) FOR [ResponseTimeWarningMs]
GO
ALTER TABLE [dbo].[WebsiteMonitorConfigs] ADD  DEFAULT ((3000)) FOR [ResponseTimeCriticalMs]
GO
ALTER TABLE [dbo].[WebsiteMonitorConfigs] ADD  DEFAULT ((1)) FOR [MultiRegionCheckEnabled]
GO
ALTER TABLE [dbo].[WebsitePerformanceAlerts] ADD  DEFAULT (sysutcdatetime()) FOR [TriggeredAt]
GO
ALTER TABLE [dbo].[WebsitePerformanceConfigs] ADD  DEFAULT ((0)) FOR [Enabled]
GO
ALTER TABLE [dbo].[WebsitePerformanceConfigs] ADD  DEFAULT ('Both') FOR [TestDevice]
GO
ALTER TABLE [dbo].[WebsitePerformanceConfigs] ADD  DEFAULT ('Daily') FOR [ScheduleType]
GO
ALTER TABLE [dbo].[WebsitePerformanceConfigs] ADD  DEFAULT ((60)) FOR [TimeoutSeconds]
GO
ALTER TABLE [dbo].[WebsitePerformanceConfigs] ADD  DEFAULT ((1)) FOR [ScreenshotCapture]
GO
ALTER TABLE [dbo].[WebsitePerformanceConfigs] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[WebsitePerformanceConfigs] ADD  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[WebsitePerformanceReports] ADD  DEFAULT (sysutcdatetime()) FOR [GeneratedAt]
GO
ALTER TABLE [dbo].[WebsitePerformanceScans] ADD  DEFAULT ('Pending') FOR [Status]
GO
ALTER TABLE [dbo].[WebsitePerformanceScans] ADD  DEFAULT ('Manual') FOR [TriggeredBy]
GO
ALTER TABLE [dbo].[WebsitePerformanceScans] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[Websites] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[Websites] ADD  DEFAULT ((1)) FOR [Enabled]
GO
ALTER TABLE [dbo].[Websites] ADD  DEFAULT ('Live') FOR [Environment]
GO
ALTER TABLE [dbo].[Websites] ADD  DEFAULT ((0)) FOR [PhpVersionManual]
GO
ALTER TABLE [dbo].[Websites] ADD  DEFAULT ((0)) FOR [PlatformVersionManual]
GO
ALTER TABLE [dbo].[WebsiteScanSchedules] ADD  DEFAULT ((1)) FOR [TimesPerDay]
GO
ALTER TABLE [dbo].[WebsiteScanSchedules] ADD  DEFAULT ('02:00') FOR [ScanTimes]
GO
ALTER TABLE [dbo].[WebsiteScanSchedules] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[WebsiteScanSchedules] ADD  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[WebsiteSslStatus] ADD  DEFAULT (sysutcdatetime()) FOR [LastCheckedAt]
GO
ALTER TABLE [dbo].[WifiAccessPointStatus] ADD  DEFAULT ('Monitor') FOR [EnforcementMode]
GO
ALTER TABLE [dbo].[WifiAllowedDevices] ADD  DEFAULT ('manual') FOR [Source]
GO
ALTER TABLE [dbo].[WifiAllowedDevices] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[WifiAllowedDevices] ADD  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[WordPressDeepScans] ADD  DEFAULT (sysutcdatetime()) FOR [ScannedAt]
GO
ALTER TABLE [dbo].[WordPressFindings] ADD  DEFAULT ('Open') FOR [Status]
GO
ALTER TABLE [dbo].[WordPressFindings] ADD  DEFAULT (sysutcdatetime()) FOR [FirstSeenAt]
GO
ALTER TABLE [dbo].[WordPressFindings] ADD  DEFAULT (sysutcdatetime()) FOR [LastSeenAt]
GO
ALTER TABLE [dbo].[WordPressFindingStatusHistory] ADD  DEFAULT (sysutcdatetime()) FOR [ChangedAt]
GO
ALTER TABLE [dbo].[WordPressScanSchedules] ADD  DEFAULT ('standard') FOR [Profile]
GO
ALTER TABLE [dbo].[WordPressScanSchedules] ADD  DEFAULT ((1)) FOR [IsActive]
GO
ALTER TABLE [dbo].[WordPressScanSchedules] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[AlertEscalationStepContacts]  WITH CHECK ADD FOREIGN KEY([AlertContactId])
REFERENCES [dbo].[AlertContacts] ([Id])
ON DELETE CASCADE
GO
ALTER TABLE [dbo].[AlertEscalationStepContacts]  WITH CHECK ADD FOREIGN KEY([StepId])
REFERENCES [dbo].[AlertEscalationSteps] ([Id])
ON DELETE CASCADE
GO
ALTER TABLE [dbo].[AlertEscalationSteps]  WITH CHECK ADD FOREIGN KEY([AlertPolicyId])
REFERENCES [dbo].[AlertPolicies] ([Id])
ON DELETE CASCADE
GO
ALTER TABLE [dbo].[AlertPolicyContacts]  WITH CHECK ADD FOREIGN KEY([AlertPolicyId])
REFERENCES [dbo].[AlertPolicies] ([Id])
ON DELETE CASCADE
GO
ALTER TABLE [dbo].[AlertPolicyContacts]  WITH CHECK ADD FOREIGN KEY([AlertContactId])
REFERENCES [dbo].[AlertContacts] ([Id])
ON DELETE CASCADE
GO
ALTER TABLE [dbo].[ApiMonitorConfigs]  WITH CHECK ADD FOREIGN KEY([MonitorId])
REFERENCES [dbo].[Monitors] ([Id])
ON DELETE CASCADE
GO
ALTER TABLE [dbo].[AppUsageSessions]  WITH CHECK ADD FOREIGN KEY([DeviceId])
REFERENCES [dbo].[Devices] ([DeviceId])
GO
ALTER TABLE [dbo].[AssetAttachments]  WITH CHECK ADD FOREIGN KEY([AssetId])
REFERENCES [dbo].[Assets] ([Id])
ON DELETE CASCADE
GO
ALTER TABLE [dbo].[AssetAttachments]  WITH CHECK ADD FOREIGN KEY([MaintenanceLogId])
REFERENCES [dbo].[MaintenanceLogs] ([Id])
GO
ALTER TABLE [dbo].[Assets]  WITH CHECK ADD FOREIGN KEY([LinkedDeviceId])
REFERENCES [dbo].[Devices] ([Id])
GO
ALTER TABLE [dbo].[Assets]  WITH CHECK ADD FOREIGN KEY([LinkedStaffId])
REFERENCES [dbo].[Staff] ([Id])
GO
ALTER TABLE [dbo].[AutomationJobs]  WITH CHECK ADD FOREIGN KEY([ScriptId])
REFERENCES [dbo].[AutomationScripts] ([Id])
GO
ALTER TABLE [dbo].[AutomationJobTargets]  WITH CHECK ADD FOREIGN KEY([DeviceId])
REFERENCES [dbo].[Devices] ([DeviceId])
GO
ALTER TABLE [dbo].[AutomationJobTargets]  WITH CHECK ADD FOREIGN KEY([JobId])
REFERENCES [dbo].[AutomationJobs] ([Id])
ON DELETE CASCADE
GO
ALTER TABLE [dbo].[AutomationSchedules]  WITH CHECK ADD FOREIGN KEY([ScriptId])
REFERENCES [dbo].[AutomationScripts] ([Id])
GO
ALTER TABLE [dbo].[AutomationScheduleTargets]  WITH CHECK ADD FOREIGN KEY([AutomationScheduleId])
REFERENCES [dbo].[AutomationSchedules] ([Id])
ON DELETE CASCADE
GO
ALTER TABLE [dbo].[AutomationScheduleTargets]  WITH CHECK ADD FOREIGN KEY([DeviceId])
REFERENCES [dbo].[Devices] ([DeviceId])
GO
ALTER TABLE [dbo].[BrowserActivityConsentAck]  WITH CHECK ADD FOREIGN KEY([DeviceId])
REFERENCES [dbo].[Devices] ([DeviceId])
GO
ALTER TABLE [dbo].[BrowserActivityEngagementAlerts]  WITH CHECK ADD FOREIGN KEY([StaffId])
REFERENCES [dbo].[Staff] ([Id])
ON DELETE CASCADE
GO
ALTER TABLE [dbo].[BrowserActivityEvents]  WITH CHECK ADD FOREIGN KEY([CategoryId])
REFERENCES [dbo].[DomainCategories] ([Id])
GO
ALTER TABLE [dbo].[BrowserActivityEvents]  WITH CHECK ADD FOREIGN KEY([DeviceId])
REFERENCES [dbo].[Devices] ([DeviceId])
GO
ALTER TABLE [dbo].[CameraMotionWatchers]  WITH CHECK ADD FOREIGN KEY([CameraId])
REFERENCES [dbo].[NvrCameras] ([Id])
GO
ALTER TABLE [dbo].[ChatMessages]  WITH CHECK ADD  CONSTRAINT [FK_ChatMessages_Devices] FOREIGN KEY([DeviceId])
REFERENCES [dbo].[Devices] ([Id])
ON DELETE SET NULL
GO
ALTER TABLE [dbo].[ChatMessages] CHECK CONSTRAINT [FK_ChatMessages_Devices]
GO
ALTER TABLE [dbo].[ChatMessages]  WITH CHECK ADD  CONSTRAINT [FK_ChatMessages_Staff] FOREIGN KEY([StaffId])
REFERENCES [dbo].[Staff] ([Id])
ON DELETE CASCADE
GO
ALTER TABLE [dbo].[ChatMessages] CHECK CONSTRAINT [FK_ChatMessages_Staff]
GO
ALTER TABLE [dbo].[CodeQualityGitHubConnections]  WITH CHECK ADD  CONSTRAINT [FK_CodeQualityGitHubConnections_CreatedBy] FOREIGN KEY([CreatedByUserId])
REFERENCES [dbo].[Users] ([Id])
GO
ALTER TABLE [dbo].[CodeQualityGitHubConnections] CHECK CONSTRAINT [FK_CodeQualityGitHubConnections_CreatedBy]
GO
ALTER TABLE [dbo].[CodeQualityGitLabConnections]  WITH CHECK ADD  CONSTRAINT [FK_CodeQualityGitLabConnections_CreatedBy] FOREIGN KEY([CreatedByUserId])
REFERENCES [dbo].[Users] ([Id])
GO
ALTER TABLE [dbo].[CodeQualityGitLabConnections] CHECK CONSTRAINT [FK_CodeQualityGitLabConnections_CreatedBy]
GO
ALTER TABLE [dbo].[CodeQualityIssues]  WITH CHECK ADD  CONSTRAINT [FK_CodeQualityIssues_Project] FOREIGN KEY([ProjectId])
REFERENCES [dbo].[CodeQualityProjects] ([Id])
GO
ALTER TABLE [dbo].[CodeQualityIssues] CHECK CONSTRAINT [FK_CodeQualityIssues_Project]
GO
ALTER TABLE [dbo].[CodeQualityIssues]  WITH CHECK ADD  CONSTRAINT [FK_CodeQualityIssues_ResolvedBy] FOREIGN KEY([ResolvedByUserId])
REFERENCES [dbo].[Users] ([Id])
ON DELETE SET NULL
GO
ALTER TABLE [dbo].[CodeQualityIssues] CHECK CONSTRAINT [FK_CodeQualityIssues_ResolvedBy]
GO
ALTER TABLE [dbo].[CodeQualityIssues]  WITH CHECK ADD  CONSTRAINT [FK_CodeQualityIssues_Scan] FOREIGN KEY([ScanId])
REFERENCES [dbo].[CodeQualityScans] ([Id])
ON DELETE CASCADE
GO
ALTER TABLE [dbo].[CodeQualityIssues] CHECK CONSTRAINT [FK_CodeQualityIssues_Scan]
GO
ALTER TABLE [dbo].[CodeQualityMetrics]  WITH CHECK ADD  CONSTRAINT [FK_CodeQualityMetrics_Scan] FOREIGN KEY([ScanId])
REFERENCES [dbo].[CodeQualityScans] ([Id])
ON DELETE CASCADE
GO
ALTER TABLE [dbo].[CodeQualityMetrics] CHECK CONSTRAINT [FK_CodeQualityMetrics_Scan]
GO
ALTER TABLE [dbo].[CodeQualityProjects]  WITH CHECK ADD  CONSTRAINT [FK_CodeQualityProjects_CreatedBy] FOREIGN KEY([CreatedByUserId])
REFERENCES [dbo].[Users] ([Id])
ON DELETE SET NULL
GO
ALTER TABLE [dbo].[CodeQualityProjects] CHECK CONSTRAINT [FK_CodeQualityProjects_CreatedBy]
GO
ALTER TABLE [dbo].[CodeQualityProjects]  WITH CHECK ADD  CONSTRAINT [FK_CodeQualityProjects_GitHubConnection] FOREIGN KEY([GitHubConnectionId])
REFERENCES [dbo].[CodeQualityGitHubConnections] ([Id])
ON DELETE SET NULL
GO
ALTER TABLE [dbo].[CodeQualityProjects] CHECK CONSTRAINT [FK_CodeQualityProjects_GitHubConnection]
GO
ALTER TABLE [dbo].[CodeQualityProjects]  WITH CHECK ADD  CONSTRAINT [FK_CodeQualityProjects_GitLabConnection] FOREIGN KEY([GitLabConnectionId])
REFERENCES [dbo].[CodeQualityGitLabConnections] ([Id])
ON DELETE SET NULL
GO
ALTER TABLE [dbo].[CodeQualityProjects] CHECK CONSTRAINT [FK_CodeQualityProjects_GitLabConnection]
GO
ALTER TABLE [dbo].[CodeQualityProjects]  WITH CHECK ADD  CONSTRAINT [FK_CodeQualityProjects_RepoConnection] FOREIGN KEY([RepoConnectionId])
REFERENCES [dbo].[RepoConnections] ([Id])
ON DELETE SET NULL
GO
ALTER TABLE [dbo].[CodeQualityProjects] CHECK CONSTRAINT [FK_CodeQualityProjects_RepoConnection]
GO
ALTER TABLE [dbo].[CodeQualityScanLog]  WITH CHECK ADD  CONSTRAINT [FK_CodeQualityScanLog_Scan] FOREIGN KEY([ScanId])
REFERENCES [dbo].[CodeQualityScans] ([Id])
ON DELETE CASCADE
GO
ALTER TABLE [dbo].[CodeQualityScanLog] CHECK CONSTRAINT [FK_CodeQualityScanLog_Scan]
GO
ALTER TABLE [dbo].[CodeQualityScans]  WITH CHECK ADD  CONSTRAINT [FK_CodeQualityScans_Project] FOREIGN KEY([ProjectId])
REFERENCES [dbo].[CodeQualityProjects] ([Id])
ON DELETE CASCADE
GO
ALTER TABLE [dbo].[CodeQualityScans] CHECK CONSTRAINT [FK_CodeQualityScans_Project]
GO
ALTER TABLE [dbo].[CodeQualityScans]  WITH CHECK ADD  CONSTRAINT [FK_CodeQualityScans_StartedBy] FOREIGN KEY([StartedByUserId])
REFERENCES [dbo].[Users] ([Id])
ON DELETE SET NULL
GO
ALTER TABLE [dbo].[CodeQualityScans] CHECK CONSTRAINT [FK_CodeQualityScans_StartedBy]
GO
ALTER TABLE [dbo].[ComplianceControlEvidence]  WITH CHECK ADD  CONSTRAINT [FK_ComplianceControlEvidence_Control] FOREIGN KEY([ControlId])
REFERENCES [dbo].[ComplianceControls] ([Id])
GO
ALTER TABLE [dbo].[ComplianceControlEvidence] CHECK CONSTRAINT [FK_ComplianceControlEvidence_Control]
GO
ALTER TABLE [dbo].[ComplianceControls]  WITH CHECK ADD  CONSTRAINT [FK_ComplianceControls_Framework] FOREIGN KEY([FrameworkId])
REFERENCES [dbo].[ComplianceFrameworks] ([Id])
GO
ALTER TABLE [dbo].[ComplianceControls] CHECK CONSTRAINT [FK_ComplianceControls_Framework]
GO
ALTER TABLE [dbo].[DashboardLayouts]  WITH CHECK ADD  CONSTRAINT [FK_DashboardLayouts_Users] FOREIGN KEY([UserId])
REFERENCES [dbo].[Users] ([Id])
ON DELETE CASCADE
GO
ALTER TABLE [dbo].[DashboardLayouts] CHECK CONSTRAINT [FK_DashboardLayouts_Users]
GO
ALTER TABLE [dbo].[DashboardNotes]  WITH CHECK ADD  CONSTRAINT [FK_DashboardNotes_Users] FOREIGN KEY([UserId])
REFERENCES [dbo].[Users] ([Id])
ON DELETE CASCADE
GO
ALTER TABLE [dbo].[DashboardNotes] CHECK CONSTRAINT [FK_DashboardNotes_Users]
GO
ALTER TABLE [dbo].[DbAnalyzerFindings]  WITH CHECK ADD FOREIGN KEY([ScanId])
REFERENCES [dbo].[DbAnalyzerScans] ([Id])
ON DELETE CASCADE
GO
ALTER TABLE [dbo].[DbAnalyzerScans]  WITH CHECK ADD FOREIGN KEY([ConnectionId])
REFERENCES [dbo].[DbAnalyzerConnections] ([Id])
ON DELETE CASCADE
GO
ALTER TABLE [dbo].[DeviceAlerts]  WITH CHECK ADD  CONSTRAINT [FK_DeviceAlerts_Devices] FOREIGN KEY([DeviceId])
REFERENCES [dbo].[Devices] ([DeviceId])
GO
ALTER TABLE [dbo].[DeviceAlerts] CHECK CONSTRAINT [FK_DeviceAlerts_Devices]
GO
ALTER TABLE [dbo].[DeviceDisks]  WITH CHECK ADD  CONSTRAINT [FK_DeviceDisks_Devices] FOREIGN KEY([DeviceId])
REFERENCES [dbo].[Devices] ([DeviceId])
GO
ALTER TABLE [dbo].[DeviceDisks] CHECK CONSTRAINT [FK_DeviceDisks_Devices]
GO
ALTER TABLE [dbo].[DeviceHardwareInfo]  WITH CHECK ADD  CONSTRAINT [FK_DeviceHardwareInfo_Devices] FOREIGN KEY([DeviceId])
REFERENCES [dbo].[Devices] ([DeviceId])
GO
ALTER TABLE [dbo].[DeviceHardwareInfo] CHECK CONSTRAINT [FK_DeviceHardwareInfo_Devices]
GO
ALTER TABLE [dbo].[DeviceMetrics]  WITH CHECK ADD  CONSTRAINT [FK_DeviceMetrics_Devices] FOREIGN KEY([DeviceId])
REFERENCES [dbo].[Devices] ([DeviceId])
GO
ALTER TABLE [dbo].[DeviceMetrics] CHECK CONSTRAINT [FK_DeviceMetrics_Devices]
GO
ALTER TABLE [dbo].[DeviceNetworkInfo]  WITH CHECK ADD  CONSTRAINT [FK_DeviceNetworkInfo_Devices] FOREIGN KEY([DeviceId])
REFERENCES [dbo].[Devices] ([DeviceId])
GO
ALTER TABLE [dbo].[DeviceNetworkInfo] CHECK CONSTRAINT [FK_DeviceNetworkInfo_Devices]
GO
ALTER TABLE [dbo].[DeviceNetworkInterfaces]  WITH CHECK ADD  CONSTRAINT [FK_DeviceNetworkInterfaces_Devices] FOREIGN KEY([DeviceId])
REFERENCES [dbo].[Devices] ([DeviceId])
GO
ALTER TABLE [dbo].[DeviceNetworkInterfaces] CHECK CONSTRAINT [FK_DeviceNetworkInterfaces_Devices]
GO
ALTER TABLE [dbo].[DeviceProcessSnapshot]  WITH CHECK ADD  CONSTRAINT [FK_DeviceProcessSnapshot_Devices] FOREIGN KEY([DeviceId])
REFERENCES [dbo].[Devices] ([DeviceId])
GO
ALTER TABLE [dbo].[DeviceProcessSnapshot] CHECK CONSTRAINT [FK_DeviceProcessSnapshot_Devices]
GO
ALTER TABLE [dbo].[Devices]  WITH CHECK ADD  CONSTRAINT [FK_Devices_RemoteConnectionId] FOREIGN KEY([RemoteConnectionId])
REFERENCES [dbo].[RemoteConnections] ([Id])
ON DELETE SET NULL
GO
ALTER TABLE [dbo].[Devices] CHECK CONSTRAINT [FK_Devices_RemoteConnectionId]
GO
ALTER TABLE [dbo].[Devices]  WITH CHECK ADD  CONSTRAINT [FK_Devices_Staff] FOREIGN KEY([StaffId])
REFERENCES [dbo].[Staff] ([Id])
GO
ALTER TABLE [dbo].[Devices] CHECK CONSTRAINT [FK_Devices_Staff]
GO
ALTER TABLE [dbo].[DeviceSecurityStatus]  WITH CHECK ADD  CONSTRAINT [FK_DeviceSecurityStatus_Devices] FOREIGN KEY([DeviceId])
REFERENCES [dbo].[Devices] ([DeviceId])
GO
ALTER TABLE [dbo].[DeviceSecurityStatus] CHECK CONSTRAINT [FK_DeviceSecurityStatus_Devices]
GO
ALTER TABLE [dbo].[DeviceServiceSnapshot]  WITH CHECK ADD  CONSTRAINT [FK_DeviceServiceSnapshot_Devices] FOREIGN KEY([DeviceId])
REFERENCES [dbo].[Devices] ([DeviceId])
GO
ALTER TABLE [dbo].[DeviceServiceSnapshot] CHECK CONSTRAINT [FK_DeviceServiceSnapshot_Devices]
GO
ALTER TABLE [dbo].[DeviceSoftwareSnapshot]  WITH CHECK ADD  CONSTRAINT [FK_DeviceSoftwareSnapshot_Devices] FOREIGN KEY([DeviceId])
REFERENCES [dbo].[Devices] ([DeviceId])
GO
ALTER TABLE [dbo].[DeviceSoftwareSnapshot] CHECK CONSTRAINT [FK_DeviceSoftwareSnapshot_Devices]
GO
ALTER TABLE [dbo].[DeviceUsbEvents]  WITH CHECK ADD  CONSTRAINT [FK_DeviceUsbEvents_Devices] FOREIGN KEY([DeviceId])
REFERENCES [dbo].[Devices] ([DeviceId])
GO
ALTER TABLE [dbo].[DeviceUsbEvents] CHECK CONSTRAINT [FK_DeviceUsbEvents_Devices]
GO
ALTER TABLE [dbo].[DeviceVolumes]  WITH CHECK ADD  CONSTRAINT [FK_DeviceVolumes_Devices] FOREIGN KEY([DeviceId])
REFERENCES [dbo].[Devices] ([DeviceId])
GO
ALTER TABLE [dbo].[DeviceVolumes] CHECK CONSTRAINT [FK_DeviceVolumes_Devices]
GO
ALTER TABLE [dbo].[DomainCategoryRules]  WITH CHECK ADD FOREIGN KEY([CategoryId])
REFERENCES [dbo].[DomainCategories] ([Id])
ON DELETE CASCADE
GO
ALTER TABLE [dbo].[EmailSecurityScans]  WITH CHECK ADD  CONSTRAINT [FK_EmailSecurityScans_Websites] FOREIGN KEY([WebsiteId])
REFERENCES [dbo].[Websites] ([Id])
ON DELETE SET NULL
GO
ALTER TABLE [dbo].[EmailSecurityScans] CHECK CONSTRAINT [FK_EmailSecurityScans_Websites]
GO
ALTER TABLE [dbo].[EmployeeNotifications]  WITH CHECK ADD  CONSTRAINT [FK_EmployeeNotifications_Staff] FOREIGN KEY([StaffId])
REFERENCES [dbo].[Staff] ([Id])
ON DELETE CASCADE
GO
ALTER TABLE [dbo].[EmployeeNotifications] CHECK CONSTRAINT [FK_EmployeeNotifications_Staff]
GO
ALTER TABLE [dbo].[EnrollmentTokens]  WITH CHECK ADD  CONSTRAINT [FK_EnrollmentTokens_Staff] FOREIGN KEY([StaffId])
REFERENCES [dbo].[Staff] ([Id])
ON DELETE SET NULL
GO
ALTER TABLE [dbo].[EnrollmentTokens] CHECK CONSTRAINT [FK_EnrollmentTokens_Staff]
GO
ALTER TABLE [dbo].[FileIntegrityEvents]  WITH CHECK ADD  CONSTRAINT [FK_FileIntegrityEvents_Devices] FOREIGN KEY([DeviceId])
REFERENCES [dbo].[Devices] ([DeviceId])
GO
ALTER TABLE [dbo].[FileIntegrityEvents] CHECK CONSTRAINT [FK_FileIntegrityEvents_Devices]
GO
ALTER TABLE [dbo].[HelpArticleFeedback]  WITH CHECK ADD  CONSTRAINT [FK_HelpArticleFeedback_Article] FOREIGN KEY([ArticleId])
REFERENCES [dbo].[HelpArticles] ([Id])
ON DELETE CASCADE
GO
ALTER TABLE [dbo].[HelpArticleFeedback] CHECK CONSTRAINT [FK_HelpArticleFeedback_Article]
GO
ALTER TABLE [dbo].[IisAppPools]  WITH CHECK ADD  CONSTRAINT [FK_IisAppPools_Devices] FOREIGN KEY([DeviceId])
REFERENCES [dbo].[Devices] ([DeviceId])
GO
ALTER TABLE [dbo].[IisAppPools] CHECK CONSTRAINT [FK_IisAppPools_Devices]
GO
ALTER TABLE [dbo].[IisPerfSnapshots]  WITH CHECK ADD  CONSTRAINT [FK_IisPerfSnapshots_Devices] FOREIGN KEY([DeviceId])
REFERENCES [dbo].[Devices] ([DeviceId])
GO
ALTER TABLE [dbo].[IisPerfSnapshots] CHECK CONSTRAINT [FK_IisPerfSnapshots_Devices]
GO
ALTER TABLE [dbo].[IisSites]  WITH CHECK ADD  CONSTRAINT [FK_IisSites_Devices] FOREIGN KEY([DeviceId])
REFERENCES [dbo].[Devices] ([DeviceId])
GO
ALTER TABLE [dbo].[IisSites] CHECK CONSTRAINT [FK_IisSites_Devices]
GO
ALTER TABLE [dbo].[IisWorkerProcesses]  WITH CHECK ADD  CONSTRAINT [FK_IisWorkerProcesses_Devices] FOREIGN KEY([DeviceId])
REFERENCES [dbo].[Devices] ([DeviceId])
GO
ALTER TABLE [dbo].[IisWorkerProcesses] CHECK CONSTRAINT [FK_IisWorkerProcesses_Devices]
GO
ALTER TABLE [dbo].[IncidentEscalations]  WITH CHECK ADD FOREIGN KEY([IncidentId])
REFERENCES [dbo].[Incidents] ([Id])
ON DELETE CASCADE
GO
ALTER TABLE [dbo].[IncidentEscalations]  WITH CHECK ADD FOREIGN KEY([StepId])
REFERENCES [dbo].[AlertEscalationSteps] ([Id])
ON DELETE CASCADE
GO
ALTER TABLE [dbo].[IncidentNotes]  WITH CHECK ADD FOREIGN KEY([IncidentId])
REFERENCES [dbo].[Incidents] ([Id])
ON DELETE CASCADE
GO
ALTER TABLE [dbo].[Incidents]  WITH CHECK ADD FOREIGN KEY([MonitorId])
REFERENCES [dbo].[Monitors] ([Id])
GO
ALTER TABLE [dbo].[ItAssetNotifications]  WITH CHECK ADD FOREIGN KEY([AssetId])
REFERENCES [dbo].[Assets] ([Id])
ON DELETE CASCADE
GO
ALTER TABLE [dbo].[LaravelSecurityIssues]  WITH CHECK ADD  CONSTRAINT [FK_LaravelSecurityIssues_Project] FOREIGN KEY([ProjectId])
REFERENCES [dbo].[LaravelSecurityProjects] ([Id])
GO
ALTER TABLE [dbo].[LaravelSecurityIssues] CHECK CONSTRAINT [FK_LaravelSecurityIssues_Project]
GO
ALTER TABLE [dbo].[LaravelSecurityIssues]  WITH CHECK ADD  CONSTRAINT [FK_LaravelSecurityIssues_ResolvedBy] FOREIGN KEY([ResolvedByUserId])
REFERENCES [dbo].[Users] ([Id])
ON DELETE SET NULL
GO
ALTER TABLE [dbo].[LaravelSecurityIssues] CHECK CONSTRAINT [FK_LaravelSecurityIssues_ResolvedBy]
GO
ALTER TABLE [dbo].[LaravelSecurityIssues]  WITH CHECK ADD  CONSTRAINT [FK_LaravelSecurityIssues_Scan] FOREIGN KEY([ScanId])
REFERENCES [dbo].[LaravelSecurityScans] ([Id])
ON DELETE CASCADE
GO
ALTER TABLE [dbo].[LaravelSecurityIssues] CHECK CONSTRAINT [FK_LaravelSecurityIssues_Scan]
GO
ALTER TABLE [dbo].[LaravelSecurityProjects]  WITH CHECK ADD  CONSTRAINT [FK_LaravelSecurityProjects_CreatedBy] FOREIGN KEY([CreatedByUserId])
REFERENCES [dbo].[Users] ([Id])
ON DELETE SET NULL
GO
ALTER TABLE [dbo].[LaravelSecurityProjects] CHECK CONSTRAINT [FK_LaravelSecurityProjects_CreatedBy]
GO
ALTER TABLE [dbo].[LaravelSecurityProjects]  WITH CHECK ADD  CONSTRAINT [FK_LaravelSecurityProjects_RepoConnection] FOREIGN KEY([RepoConnectionId])
REFERENCES [dbo].[RepoConnections] ([Id])
ON DELETE SET NULL
GO
ALTER TABLE [dbo].[LaravelSecurityProjects] CHECK CONSTRAINT [FK_LaravelSecurityProjects_RepoConnection]
GO
ALTER TABLE [dbo].[LaravelSecurityScanLog]  WITH CHECK ADD  CONSTRAINT [FK_LaravelSecurityScanLog_Scan] FOREIGN KEY([ScanId])
REFERENCES [dbo].[LaravelSecurityScans] ([Id])
ON DELETE CASCADE
GO
ALTER TABLE [dbo].[LaravelSecurityScanLog] CHECK CONSTRAINT [FK_LaravelSecurityScanLog_Scan]
GO
ALTER TABLE [dbo].[LaravelSecurityScans]  WITH CHECK ADD  CONSTRAINT [FK_LaravelSecurityScans_Project] FOREIGN KEY([ProjectId])
REFERENCES [dbo].[LaravelSecurityProjects] ([Id])
ON DELETE CASCADE
GO
ALTER TABLE [dbo].[LaravelSecurityScans] CHECK CONSTRAINT [FK_LaravelSecurityScans_Project]
GO
ALTER TABLE [dbo].[LaravelSecurityScans]  WITH CHECK ADD  CONSTRAINT [FK_LaravelSecurityScans_StartedBy] FOREIGN KEY([StartedByUserId])
REFERENCES [dbo].[Users] ([Id])
ON DELETE SET NULL
GO
ALTER TABLE [dbo].[LaravelSecurityScans] CHECK CONSTRAINT [FK_LaravelSecurityScans_StartedBy]
GO
ALTER TABLE [dbo].[LinuxFail2banJails]  WITH CHECK ADD  CONSTRAINT [FK_LinuxFail2banJails_Devices] FOREIGN KEY([DeviceId])
REFERENCES [dbo].[Devices] ([DeviceId])
GO
ALTER TABLE [dbo].[LinuxFail2banJails] CHECK CONSTRAINT [FK_LinuxFail2banJails_Devices]
GO
ALTER TABLE [dbo].[LinuxOpenPorts]  WITH CHECK ADD  CONSTRAINT [FK_LinuxOpenPorts_Devices] FOREIGN KEY([DeviceId])
REFERENCES [dbo].[Devices] ([DeviceId])
GO
ALTER TABLE [dbo].[LinuxOpenPorts] CHECK CONSTRAINT [FK_LinuxOpenPorts_Devices]
GO
ALTER TABLE [dbo].[LinuxPermissionFindings]  WITH CHECK ADD  CONSTRAINT [FK_LinuxPermissionFindings_Devices] FOREIGN KEY([DeviceId])
REFERENCES [dbo].[Devices] ([DeviceId])
GO
ALTER TABLE [dbo].[LinuxPermissionFindings] CHECK CONSTRAINT [FK_LinuxPermissionFindings_Devices]
GO
ALTER TABLE [dbo].[LinuxSecurityStatus]  WITH CHECK ADD  CONSTRAINT [FK_LinuxSecurityStatus_Devices] FOREIGN KEY([DeviceId])
REFERENCES [dbo].[Devices] ([DeviceId])
GO
ALTER TABLE [dbo].[LinuxSecurityStatus] CHECK CONSTRAINT [FK_LinuxSecurityStatus_Devices]
GO
ALTER TABLE [dbo].[LinuxSudoNopasswdEntries]  WITH CHECK ADD  CONSTRAINT [FK_LinuxSudoNopasswdEntries_Devices] FOREIGN KEY([DeviceId])
REFERENCES [dbo].[Devices] ([DeviceId])
GO
ALTER TABLE [dbo].[LinuxSudoNopasswdEntries] CHECK CONSTRAINT [FK_LinuxSudoNopasswdEntries_Devices]
GO
ALTER TABLE [dbo].[MailIncidentAttachments]  WITH CHECK ADD  CONSTRAINT [FK_MailIncidentAttachments_Incident] FOREIGN KEY([IncidentId])
REFERENCES [dbo].[MailSecurityIncidents] ([Id])
ON DELETE CASCADE
GO
ALTER TABLE [dbo].[MailIncidentAttachments] CHECK CONSTRAINT [FK_MailIncidentAttachments_Incident]
GO
ALTER TABLE [dbo].[MailIncidentUrls]  WITH CHECK ADD  CONSTRAINT [FK_MailIncidentUrls_Incident] FOREIGN KEY([IncidentId])
REFERENCES [dbo].[MailSecurityIncidents] ([Id])
ON DELETE CASCADE
GO
ALTER TABLE [dbo].[MailIncidentUrls] CHECK CONSTRAINT [FK_MailIncidentUrls_Incident]
GO
ALTER TABLE [dbo].[MailPolicyExceptions]  WITH CHECK ADD  CONSTRAINT [FK_MailPolicyExceptions_Policy] FOREIGN KEY([PolicyId])
REFERENCES [dbo].[MailBlockingPolicies] ([Id])
ON DELETE CASCADE
GO
ALTER TABLE [dbo].[MailPolicyExceptions] CHECK CONSTRAINT [FK_MailPolicyExceptions_Policy]
GO
ALTER TABLE [dbo].[MailPolicyScopes]  WITH CHECK ADD  CONSTRAINT [FK_MailPolicyScopes_Policy] FOREIGN KEY([PolicyId])
REFERENCES [dbo].[MailBlockingPolicies] ([Id])
ON DELETE CASCADE
GO
ALTER TABLE [dbo].[MailPolicyScopes] CHECK CONSTRAINT [FK_MailPolicyScopes_Policy]
GO
ALTER TABLE [dbo].[MailSecurityIncidents]  WITH CHECK ADD  CONSTRAINT [FK_MailSecurityIncidents_Exception] FOREIGN KEY([ExceptionUsedId])
REFERENCES [dbo].[MailPolicyExceptions] ([Id])
GO
ALTER TABLE [dbo].[MailSecurityIncidents] CHECK CONSTRAINT [FK_MailSecurityIncidents_Exception]
GO
ALTER TABLE [dbo].[MailSecurityIncidents]  WITH CHECK ADD  CONSTRAINT [FK_MailSecurityIncidents_Policy] FOREIGN KEY([MatchedPolicyId])
REFERENCES [dbo].[MailBlockingPolicies] ([Id])
GO
ALTER TABLE [dbo].[MailSecurityIncidents] CHECK CONSTRAINT [FK_MailSecurityIncidents_Policy]
GO
ALTER TABLE [dbo].[MaintenanceLogs]  WITH CHECK ADD FOREIGN KEY([AssetId])
REFERENCES [dbo].[Assets] ([Id])
ON DELETE CASCADE
GO
ALTER TABLE [dbo].[MaintenanceWindowMonitors]  WITH CHECK ADD FOREIGN KEY([MaintenanceWindowId])
REFERENCES [dbo].[MaintenanceWindows] ([Id])
ON DELETE CASCADE
GO
ALTER TABLE [dbo].[MaintenanceWindowMonitors]  WITH CHECK ADD FOREIGN KEY([MonitorId])
REFERENCES [dbo].[Monitors] ([Id])
ON DELETE CASCADE
GO
ALTER TABLE [dbo].[MalwareFindings]  WITH CHECK ADD  CONSTRAINT [FK_MalwareFindings_Device] FOREIGN KEY([DeviceId])
REFERENCES [dbo].[Devices] ([DeviceId])
GO
ALTER TABLE [dbo].[MalwareFindings] CHECK CONSTRAINT [FK_MalwareFindings_Device]
GO
ALTER TABLE [dbo].[MalwareFindings]  WITH CHECK ADD  CONSTRAINT [FK_MalwareFindings_ResolvedBy] FOREIGN KEY([ResolvedByUserId])
REFERENCES [dbo].[Users] ([Id])
ON DELETE SET NULL
GO
ALTER TABLE [dbo].[MalwareFindings] CHECK CONSTRAINT [FK_MalwareFindings_ResolvedBy]
GO
ALTER TABLE [dbo].[MalwareFindings]  WITH CHECK ADD  CONSTRAINT [FK_MalwareFindings_Scan] FOREIGN KEY([ScanId])
REFERENCES [dbo].[MalwareScans] ([Id])
ON DELETE CASCADE
GO
ALTER TABLE [dbo].[MalwareFindings] CHECK CONSTRAINT [FK_MalwareFindings_Scan]
GO
ALTER TABLE [dbo].[MalwareFindings]  WITH CHECK ADD  CONSTRAINT [FK_MalwareFindings_Website] FOREIGN KEY([WebsiteId])
REFERENCES [dbo].[Websites] ([Id])
GO
ALTER TABLE [dbo].[MalwareFindings] CHECK CONSTRAINT [FK_MalwareFindings_Website]
GO
ALTER TABLE [dbo].[MalwareScans]  WITH CHECK ADD  CONSTRAINT [FK_MalwareScans_Device] FOREIGN KEY([DeviceId])
REFERENCES [dbo].[Devices] ([DeviceId])
ON DELETE CASCADE
GO
ALTER TABLE [dbo].[MalwareScans] CHECK CONSTRAINT [FK_MalwareScans_Device]
GO
ALTER TABLE [dbo].[MalwareScans]  WITH CHECK ADD  CONSTRAINT [FK_MalwareScans_Website] FOREIGN KEY([WebsiteId])
REFERENCES [dbo].[Websites] ([Id])
ON DELETE CASCADE
GO
ALTER TABLE [dbo].[MalwareScans] CHECK CONSTRAINT [FK_MalwareScans_Website]
GO
ALTER TABLE [dbo].[MobileInternetControl]  WITH CHECK ADD FOREIGN KEY([AllowScheduleId])
REFERENCES [dbo].[WacSchedules] ([Id])
GO
ALTER TABLE [dbo].[MobileInternetControl]  WITH CHECK ADD FOREIGN KEY([BlockScheduleId])
REFERENCES [dbo].[WacSchedules] ([Id])
GO
ALTER TABLE [dbo].[MonitorMetricsDaily]  WITH CHECK ADD FOREIGN KEY([MonitorId])
REFERENCES [dbo].[Monitors] ([Id])
ON DELETE CASCADE
GO
ALTER TABLE [dbo].[MonitorMetricsHourly]  WITH CHECK ADD FOREIGN KEY([MonitorId])
REFERENCES [dbo].[Monitors] ([Id])
ON DELETE CASCADE
GO
ALTER TABLE [dbo].[MonitorResults]  WITH CHECK ADD FOREIGN KEY([MonitorId])
REFERENCES [dbo].[Monitors] ([Id])
ON DELETE CASCADE
GO
ALTER TABLE [dbo].[NetworkDiagramDesigns]  WITH CHECK ADD  CONSTRAINT [FK_NetworkDiagramDesigns_CreatedBy] FOREIGN KEY([CreatedByUserId])
REFERENCES [dbo].[Users] ([Id])
GO
ALTER TABLE [dbo].[NetworkDiagramDesigns] CHECK CONSTRAINT [FK_NetworkDiagramDesigns_CreatedBy]
GO
ALTER TABLE [dbo].[NetworkDiagramDesigns]  WITH CHECK ADD  CONSTRAINT [FK_NetworkDiagramDesigns_Owner] FOREIGN KEY([OwnerUserId])
REFERENCES [dbo].[Users] ([Id])
GO
ALTER TABLE [dbo].[NetworkDiagramDesigns] CHECK CONSTRAINT [FK_NetworkDiagramDesigns_Owner]
GO
ALTER TABLE [dbo].[NvrCameras]  WITH CHECK ADD  CONSTRAINT [FK_NvrCameras_NvrDevices] FOREIGN KEY([NvrId])
REFERENCES [dbo].[NvrDevices] ([Id])
ON DELETE CASCADE
GO
ALTER TABLE [dbo].[NvrCameras] CHECK CONSTRAINT [FK_NvrCameras_NvrDevices]
GO
ALTER TABLE [dbo].[OffboardingActions]  WITH CHECK ADD  CONSTRAINT [FK_OffboardingActions_Staff] FOREIGN KEY([StaffId])
REFERENCES [dbo].[Staff] ([Id])
GO
ALTER TABLE [dbo].[OffboardingActions] CHECK CONSTRAINT [FK_OffboardingActions_Staff]
GO
ALTER TABLE [dbo].[PasswordChangeLogs]  WITH CHECK ADD FOREIGN KEY([AssetId])
REFERENCES [dbo].[Assets] ([Id])
ON DELETE CASCADE
GO
ALTER TABLE [dbo].[PatchUpdateLogs]  WITH CHECK ADD FOREIGN KEY([AssetId])
REFERENCES [dbo].[Assets] ([Id])
ON DELETE CASCADE
GO
ALTER TABLE [dbo].[PendingMalwareScanRequests]  WITH CHECK ADD  CONSTRAINT [FK_PendingMalwareScanRequests_Devices] FOREIGN KEY([DeviceId])
REFERENCES [dbo].[Devices] ([DeviceId])
GO
ALTER TABLE [dbo].[PendingMalwareScanRequests] CHECK CONSTRAINT [FK_PendingMalwareScanRequests_Devices]
GO
ALTER TABLE [dbo].[PendingPhpLogRequests]  WITH CHECK ADD  CONSTRAINT [FK_PendingPhpLogRequests_Devices] FOREIGN KEY([DeviceId])
REFERENCES [dbo].[Devices] ([DeviceId])
GO
ALTER TABLE [dbo].[PendingPhpLogRequests] CHECK CONSTRAINT [FK_PendingPhpLogRequests_Devices]
GO
ALTER TABLE [dbo].[PendingPowerActionRequests]  WITH CHECK ADD FOREIGN KEY([DeviceId])
REFERENCES [dbo].[Devices] ([DeviceId])
GO
ALTER TABLE [dbo].[PendingScreenshotRequests]  WITH CHECK ADD  CONSTRAINT [FK_PendingScreenshotRequests_Devices] FOREIGN KEY([DeviceId])
REFERENCES [dbo].[Devices] ([DeviceId])
GO
ALTER TABLE [dbo].[PendingScreenshotRequests] CHECK CONSTRAINT [FK_PendingScreenshotRequests_Devices]
GO
ALTER TABLE [dbo].[PhpLogContent]  WITH CHECK ADD  CONSTRAINT [FK_PhpLogContent_Devices] FOREIGN KEY([DeviceId])
REFERENCES [dbo].[Devices] ([DeviceId])
GO
ALTER TABLE [dbo].[PhpLogContent] CHECK CONSTRAINT [FK_PhpLogContent_Devices]
GO
ALTER TABLE [dbo].[PhpVersions]  WITH CHECK ADD  CONSTRAINT [FK_PhpVersions_Devices] FOREIGN KEY([DeviceId])
REFERENCES [dbo].[Devices] ([DeviceId])
GO
ALTER TABLE [dbo].[PhpVersions] CHECK CONSTRAINT [FK_PhpVersions_Devices]
GO
ALTER TABLE [dbo].[QaBugs]  WITH CHECK ADD  CONSTRAINT [FK_QaBugs_QaProjects] FOREIGN KEY([ProjectId])
REFERENCES [dbo].[QaProjects] ([Id])
GO
ALTER TABLE [dbo].[QaBugs] CHECK CONSTRAINT [FK_QaBugs_QaProjects]
GO
ALTER TABLE [dbo].[QaBugs]  WITH CHECK ADD  CONSTRAINT [FK_QaBugs_QaTestCases] FOREIGN KEY([TestCaseId])
REFERENCES [dbo].[QaTestCases] ([Id])
GO
ALTER TABLE [dbo].[QaBugs] CHECK CONSTRAINT [FK_QaBugs_QaTestCases]
GO
ALTER TABLE [dbo].[QaBugs]  WITH CHECK ADD  CONSTRAINT [FK_QaBugs_QaTestExecutions] FOREIGN KEY([TestExecutionId])
REFERENCES [dbo].[QaTestExecutions] ([Id])
GO
ALTER TABLE [dbo].[QaBugs] CHECK CONSTRAINT [FK_QaBugs_QaTestExecutions]
GO
ALTER TABLE [dbo].[QaBugs]  WITH CHECK ADD  CONSTRAINT [FK_QaBugs_QaTestRuns] FOREIGN KEY([TestRunId])
REFERENCES [dbo].[QaTestRuns] ([Id])
GO
ALTER TABLE [dbo].[QaBugs] CHECK CONSTRAINT [FK_QaBugs_QaTestRuns]
GO
ALTER TABLE [dbo].[QaBuilds]  WITH CHECK ADD  CONSTRAINT [FK_QaBuilds_QaEnvironments] FOREIGN KEY([EnvironmentId])
REFERENCES [dbo].[QaEnvironments] ([Id])
GO
ALTER TABLE [dbo].[QaBuilds] CHECK CONSTRAINT [FK_QaBuilds_QaEnvironments]
GO
ALTER TABLE [dbo].[QaBuilds]  WITH CHECK ADD  CONSTRAINT [FK_QaBuilds_QaProjects] FOREIGN KEY([ProjectId])
REFERENCES [dbo].[QaProjects] ([Id])
GO
ALTER TABLE [dbo].[QaBuilds] CHECK CONSTRAINT [FK_QaBuilds_QaProjects]
GO
ALTER TABLE [dbo].[QaBuilds]  WITH CHECK ADD  CONSTRAINT [FK_QaBuilds_QaReleases] FOREIGN KEY([ReleaseId])
REFERENCES [dbo].[QaReleases] ([Id])
GO
ALTER TABLE [dbo].[QaBuilds] CHECK CONSTRAINT [FK_QaBuilds_QaReleases]
GO
ALTER TABLE [dbo].[QaEnvironments]  WITH CHECK ADD  CONSTRAINT [FK_QaEnvironments_QaProjects] FOREIGN KEY([ProjectId])
REFERENCES [dbo].[QaProjects] ([Id])
GO
ALTER TABLE [dbo].[QaEnvironments] CHECK CONSTRAINT [FK_QaEnvironments_QaProjects]
GO
ALTER TABLE [dbo].[QaMilestones]  WITH CHECK ADD  CONSTRAINT [FK_QaMilestones_QaProjects] FOREIGN KEY([ProjectId])
REFERENCES [dbo].[QaProjects] ([Id])
GO
ALTER TABLE [dbo].[QaMilestones] CHECK CONSTRAINT [FK_QaMilestones_QaProjects]
GO
ALTER TABLE [dbo].[QaMilestones]  WITH CHECK ADD  CONSTRAINT [FK_QaMilestones_QaReleases] FOREIGN KEY([ReleaseId])
REFERENCES [dbo].[QaReleases] ([Id])
GO
ALTER TABLE [dbo].[QaMilestones] CHECK CONSTRAINT [FK_QaMilestones_QaReleases]
GO
ALTER TABLE [dbo].[QaMilestoneTestPlans]  WITH CHECK ADD  CONSTRAINT [FK_QaMilestoneTestPlans_QaMilestones] FOREIGN KEY([MilestoneId])
REFERENCES [dbo].[QaMilestones] ([Id])
GO
ALTER TABLE [dbo].[QaMilestoneTestPlans] CHECK CONSTRAINT [FK_QaMilestoneTestPlans_QaMilestones]
GO
ALTER TABLE [dbo].[QaMilestoneTestPlans]  WITH CHECK ADD  CONSTRAINT [FK_QaMilestoneTestPlans_QaTestPlans] FOREIGN KEY([TestPlanId])
REFERENCES [dbo].[QaTestPlans] ([Id])
GO
ALTER TABLE [dbo].[QaMilestoneTestPlans] CHECK CONSTRAINT [FK_QaMilestoneTestPlans_QaTestPlans]
GO
ALTER TABLE [dbo].[QaModules]  WITH CHECK ADD  CONSTRAINT [FK_QaModules_QaProjects] FOREIGN KEY([ProjectId])
REFERENCES [dbo].[QaProjects] ([Id])
GO
ALTER TABLE [dbo].[QaModules] CHECK CONSTRAINT [FK_QaModules_QaProjects]
GO
ALTER TABLE [dbo].[QaReleases]  WITH CHECK ADD  CONSTRAINT [FK_QaReleases_QaProjects] FOREIGN KEY([ProjectId])
REFERENCES [dbo].[QaProjects] ([Id])
GO
ALTER TABLE [dbo].[QaReleases] CHECK CONSTRAINT [FK_QaReleases_QaProjects]
GO
ALTER TABLE [dbo].[QaRequirements]  WITH CHECK ADD  CONSTRAINT [FK_QaRequirements_QaProjects] FOREIGN KEY([ProjectId])
REFERENCES [dbo].[QaProjects] ([Id])
GO
ALTER TABLE [dbo].[QaRequirements] CHECK CONSTRAINT [FK_QaRequirements_QaProjects]
GO
ALTER TABLE [dbo].[QaRequirementTestCases]  WITH CHECK ADD  CONSTRAINT [FK_QaRequirementTestCases_QaRequirements] FOREIGN KEY([RequirementId])
REFERENCES [dbo].[QaRequirements] ([Id])
GO
ALTER TABLE [dbo].[QaRequirementTestCases] CHECK CONSTRAINT [FK_QaRequirementTestCases_QaRequirements]
GO
ALTER TABLE [dbo].[QaRequirementTestCases]  WITH CHECK ADD  CONSTRAINT [FK_QaRequirementTestCases_QaTestCases] FOREIGN KEY([TestCaseId])
REFERENCES [dbo].[QaTestCases] ([Id])
GO
ALTER TABLE [dbo].[QaRequirementTestCases] CHECK CONSTRAINT [FK_QaRequirementTestCases_QaTestCases]
GO
ALTER TABLE [dbo].[QaTestCaseRunTypes]  WITH CHECK ADD  CONSTRAINT [FK_QaTestCaseRunTypes_QaTestCases] FOREIGN KEY([TestCaseId])
REFERENCES [dbo].[QaTestCases] ([Id])
GO
ALTER TABLE [dbo].[QaTestCaseRunTypes] CHECK CONSTRAINT [FK_QaTestCaseRunTypes_QaTestCases]
GO
ALTER TABLE [dbo].[QaTestCaseRunTypes]  WITH CHECK ADD  CONSTRAINT [FK_QaTestCaseRunTypes_QaTestRunTypes] FOREIGN KEY([RunTypeId])
REFERENCES [dbo].[QaTestRunTypes] ([Id])
GO
ALTER TABLE [dbo].[QaTestCaseRunTypes] CHECK CONSTRAINT [FK_QaTestCaseRunTypes_QaTestRunTypes]
GO
ALTER TABLE [dbo].[QaTestCases]  WITH CHECK ADD  CONSTRAINT [FK_QaTestCases_QaModules] FOREIGN KEY([ModuleId])
REFERENCES [dbo].[QaModules] ([Id])
GO
ALTER TABLE [dbo].[QaTestCases] CHECK CONSTRAINT [FK_QaTestCases_QaModules]
GO
ALTER TABLE [dbo].[QaTestCases]  WITH CHECK ADD  CONSTRAINT [FK_QaTestCases_QaProjects] FOREIGN KEY([ProjectId])
REFERENCES [dbo].[QaProjects] ([Id])
GO
ALTER TABLE [dbo].[QaTestCases] CHECK CONSTRAINT [FK_QaTestCases_QaProjects]
GO
ALTER TABLE [dbo].[QaTestCases]  WITH CHECK ADD  CONSTRAINT [FK_QaTestCases_QaTestSuites] FOREIGN KEY([TestSuiteId])
REFERENCES [dbo].[QaTestSuites] ([Id])
GO
ALTER TABLE [dbo].[QaTestCases] CHECK CONSTRAINT [FK_QaTestCases_QaTestSuites]
GO
ALTER TABLE [dbo].[QaTestCaseSteps]  WITH CHECK ADD  CONSTRAINT [FK_QaTestCaseSteps_QaTestCases] FOREIGN KEY([TestCaseId])
REFERENCES [dbo].[QaTestCases] ([Id])
GO
ALTER TABLE [dbo].[QaTestCaseSteps] CHECK CONSTRAINT [FK_QaTestCaseSteps_QaTestCases]
GO
ALTER TABLE [dbo].[QaTestCaseTags]  WITH CHECK ADD  CONSTRAINT [FK_QaTestCaseTags_QaTestCases] FOREIGN KEY([TestCaseId])
REFERENCES [dbo].[QaTestCases] ([Id])
GO
ALTER TABLE [dbo].[QaTestCaseTags] CHECK CONSTRAINT [FK_QaTestCaseTags_QaTestCases]
GO
ALTER TABLE [dbo].[QaTestExecutions]  WITH CHECK ADD  CONSTRAINT [FK_QaTestExecutions_QaTestRunCases] FOREIGN KEY([TestRunCaseId])
REFERENCES [dbo].[QaTestRunCases] ([Id])
GO
ALTER TABLE [dbo].[QaTestExecutions] CHECK CONSTRAINT [FK_QaTestExecutions_QaTestRunCases]
GO
ALTER TABLE [dbo].[QaTestPlanRuns]  WITH CHECK ADD  CONSTRAINT [FK_QaTestPlanRuns_QaTestPlans] FOREIGN KEY([TestPlanId])
REFERENCES [dbo].[QaTestPlans] ([Id])
GO
ALTER TABLE [dbo].[QaTestPlanRuns] CHECK CONSTRAINT [FK_QaTestPlanRuns_QaTestPlans]
GO
ALTER TABLE [dbo].[QaTestPlanRuns]  WITH CHECK ADD  CONSTRAINT [FK_QaTestPlanRuns_QaTestRuns] FOREIGN KEY([TestRunId])
REFERENCES [dbo].[QaTestRuns] ([Id])
GO
ALTER TABLE [dbo].[QaTestPlanRuns] CHECK CONSTRAINT [FK_QaTestPlanRuns_QaTestRuns]
GO
ALTER TABLE [dbo].[QaTestPlans]  WITH CHECK ADD  CONSTRAINT [FK_QaTestPlans_QaProjects] FOREIGN KEY([ProjectId])
REFERENCES [dbo].[QaProjects] ([Id])
GO
ALTER TABLE [dbo].[QaTestPlans] CHECK CONSTRAINT [FK_QaTestPlans_QaProjects]
GO
ALTER TABLE [dbo].[QaTestPlans]  WITH CHECK ADD  CONSTRAINT [FK_QaTestPlans_QaReleases] FOREIGN KEY([ReleaseId])
REFERENCES [dbo].[QaReleases] ([Id])
GO
ALTER TABLE [dbo].[QaTestPlans] CHECK CONSTRAINT [FK_QaTestPlans_QaReleases]
GO
ALTER TABLE [dbo].[QaTestRunCases]  WITH CHECK ADD  CONSTRAINT [FK_QaTestRunCases_QaTestCases] FOREIGN KEY([TestCaseId])
REFERENCES [dbo].[QaTestCases] ([Id])
GO
ALTER TABLE [dbo].[QaTestRunCases] CHECK CONSTRAINT [FK_QaTestRunCases_QaTestCases]
GO
ALTER TABLE [dbo].[QaTestRunCases]  WITH CHECK ADD  CONSTRAINT [FK_QaTestRunCases_QaTestRuns] FOREIGN KEY([TestRunId])
REFERENCES [dbo].[QaTestRuns] ([Id])
GO
ALTER TABLE [dbo].[QaTestRunCases] CHECK CONSTRAINT [FK_QaTestRunCases_QaTestRuns]
GO
ALTER TABLE [dbo].[QaTestRuns]  WITH CHECK ADD  CONSTRAINT [FK_QaTestRuns_QaBuilds] FOREIGN KEY([BuildId])
REFERENCES [dbo].[QaBuilds] ([Id])
GO
ALTER TABLE [dbo].[QaTestRuns] CHECK CONSTRAINT [FK_QaTestRuns_QaBuilds]
GO
ALTER TABLE [dbo].[QaTestRuns]  WITH CHECK ADD  CONSTRAINT [FK_QaTestRuns_QaEnvironments] FOREIGN KEY([EnvironmentId])
REFERENCES [dbo].[QaEnvironments] ([Id])
GO
ALTER TABLE [dbo].[QaTestRuns] CHECK CONSTRAINT [FK_QaTestRuns_QaEnvironments]
GO
ALTER TABLE [dbo].[QaTestRuns]  WITH CHECK ADD  CONSTRAINT [FK_QaTestRuns_QaProjects] FOREIGN KEY([ProjectId])
REFERENCES [dbo].[QaProjects] ([Id])
GO
ALTER TABLE [dbo].[QaTestRuns] CHECK CONSTRAINT [FK_QaTestRuns_QaProjects]
GO
ALTER TABLE [dbo].[QaTestRuns]  WITH CHECK ADD  CONSTRAINT [FK_QaTestRuns_QaReleases] FOREIGN KEY([ReleaseId])
REFERENCES [dbo].[QaReleases] ([Id])
GO
ALTER TABLE [dbo].[QaTestRuns] CHECK CONSTRAINT [FK_QaTestRuns_QaReleases]
GO
ALTER TABLE [dbo].[QaTestSuites]  WITH CHECK ADD  CONSTRAINT [FK_QaTestSuites_QaModules] FOREIGN KEY([ModuleId])
REFERENCES [dbo].[QaModules] ([Id])
GO
ALTER TABLE [dbo].[QaTestSuites] CHECK CONSTRAINT [FK_QaTestSuites_QaModules]
GO
ALTER TABLE [dbo].[QaTestSuites]  WITH CHECK ADD  CONSTRAINT [FK_QaTestSuites_QaProjects] FOREIGN KEY([ProjectId])
REFERENCES [dbo].[QaProjects] ([Id])
GO
ALTER TABLE [dbo].[QaTestSuites] CHECK CONSTRAINT [FK_QaTestSuites_QaProjects]
GO
ALTER TABLE [dbo].[RemoteAuditLog]  WITH CHECK ADD FOREIGN KEY([ConnectionId])
REFERENCES [dbo].[RemoteConnections] ([Id])
ON DELETE SET NULL
GO
ALTER TABLE [dbo].[RemoteCertificates]  WITH CHECK ADD FOREIGN KEY([ConnectionId])
REFERENCES [dbo].[RemoteConnections] ([Id])
ON DELETE CASCADE
GO
ALTER TABLE [dbo].[RemoteConnectionChecks]  WITH CHECK ADD FOREIGN KEY([ConnectionId])
REFERENCES [dbo].[RemoteConnections] ([Id])
ON DELETE CASCADE
GO
ALTER TABLE [dbo].[RemoteConnectionGroups]  WITH CHECK ADD  CONSTRAINT [FK_RemoteConnectionGroups_Parent] FOREIGN KEY([ParentGroupId])
REFERENCES [dbo].[RemoteConnectionGroups] ([Id])
GO
ALTER TABLE [dbo].[RemoteConnectionGroups] CHECK CONSTRAINT [FK_RemoteConnectionGroups_Parent]
GO
ALTER TABLE [dbo].[RemoteConnections]  WITH CHECK ADD  CONSTRAINT [FK_RemoteConnections_Credential] FOREIGN KEY([CredentialId])
REFERENCES [dbo].[RemoteCredentials] ([Id])
ON DELETE SET NULL
GO
ALTER TABLE [dbo].[RemoteConnections] CHECK CONSTRAINT [FK_RemoteConnections_Credential]
GO
ALTER TABLE [dbo].[RemoteConnections]  WITH CHECK ADD  CONSTRAINT [FK_RemoteConnections_Group] FOREIGN KEY([GroupId])
REFERENCES [dbo].[RemoteConnectionGroups] ([Id])
ON DELETE SET NULL
GO
ALTER TABLE [dbo].[RemoteConnections] CHECK CONSTRAINT [FK_RemoteConnections_Group]
GO
ALTER TABLE [dbo].[RemoteConnections]  WITH CHECK ADD  CONSTRAINT [FK_RemoteConnections_JumpHost] FOREIGN KEY([JumpHostConnectionId])
REFERENCES [dbo].[RemoteConnections] ([Id])
GO
ALTER TABLE [dbo].[RemoteConnections] CHECK CONSTRAINT [FK_RemoteConnections_JumpHost]
GO
ALTER TABLE [dbo].[RemoteConnections]  WITH CHECK ADD  CONSTRAINT [FK_RemoteConnections_SshKey] FOREIGN KEY([SshKeyId])
REFERENCES [dbo].[RemoteSSHKeys] ([Id])
ON DELETE SET NULL
GO
ALTER TABLE [dbo].[RemoteConnections] CHECK CONSTRAINT [FK_RemoteConnections_SshKey]
GO
ALTER TABLE [dbo].[RemoteFileTransfers]  WITH CHECK ADD FOREIGN KEY([ConnectionId])
REFERENCES [dbo].[RemoteConnections] ([Id])
GO
ALTER TABLE [dbo].[RemoteFileTransfers]  WITH CHECK ADD FOREIGN KEY([SessionId])
REFERENCES [dbo].[RemoteSessions] ([Id])
GO
ALTER TABLE [dbo].[RemoteInventoryDevices]  WITH CHECK ADD FOREIGN KEY([LinkedDeviceId])
REFERENCES [dbo].[Devices] ([DeviceId])
GO
ALTER TABLE [dbo].[RemoteInventoryDevices]  WITH CHECK ADD FOREIGN KEY([LinkedConnectionId])
REFERENCES [dbo].[RemoteConnections] ([Id])
GO
ALTER TABLE [dbo].[RemotePortForwards]  WITH CHECK ADD FOREIGN KEY([ConnectionId])
REFERENCES [dbo].[RemoteConnections] ([Id])
ON DELETE CASCADE
GO
ALTER TABLE [dbo].[RemoteProtocolDiagnostics]  WITH CHECK ADD FOREIGN KEY([ConnectionId])
REFERENCES [dbo].[RemoteConnections] ([Id])
ON DELETE CASCADE
GO
ALTER TABLE [dbo].[RemoteScriptExecutions]  WITH CHECK ADD FOREIGN KEY([ConnectionId])
REFERENCES [dbo].[RemoteConnections] ([Id])
GO
ALTER TABLE [dbo].[RemoteScriptExecutions]  WITH CHECK ADD FOREIGN KEY([ScriptId])
REFERENCES [dbo].[RemoteScripts] ([Id])
ON DELETE CASCADE
GO
ALTER TABLE [dbo].[RemoteSessionEvents]  WITH CHECK ADD  CONSTRAINT [FK_RemoteSessionEvents_Session] FOREIGN KEY([SessionId])
REFERENCES [dbo].[RemoteSupportSessions] ([Id])
GO
ALTER TABLE [dbo].[RemoteSessionEvents] CHECK CONSTRAINT [FK_RemoteSessionEvents_Session]
GO
ALTER TABLE [dbo].[RemoteSessionFileTransfers]  WITH CHECK ADD  CONSTRAINT [FK_RemoteSessionFileTransfers_Session] FOREIGN KEY([SessionId])
REFERENCES [dbo].[RemoteSupportSessions] ([Id])
GO
ALTER TABLE [dbo].[RemoteSessionFileTransfers] CHECK CONSTRAINT [FK_RemoteSessionFileTransfers_Session]
GO
ALTER TABLE [dbo].[RemoteSessionLogs]  WITH CHECK ADD FOREIGN KEY([SessionId])
REFERENCES [dbo].[RemoteSessions] ([Id])
ON DELETE CASCADE
GO
ALTER TABLE [dbo].[RemoteSessions]  WITH CHECK ADD FOREIGN KEY([ConnectionId])
REFERENCES [dbo].[RemoteConnections] ([Id])
GO
ALTER TABLE [dbo].[RemoteSessionSignaling]  WITH CHECK ADD  CONSTRAINT [FK_RemoteSessionSignaling_Session] FOREIGN KEY([SessionId])
REFERENCES [dbo].[RemoteSupportSessions] ([Id])
GO
ALTER TABLE [dbo].[RemoteSessionSignaling] CHECK CONSTRAINT [FK_RemoteSessionSignaling_Session]
GO
ALTER TABLE [dbo].[RemoteSSHKeys]  WITH CHECK ADD  CONSTRAINT [FK_RemoteSSHKeys_PassphraseCredential] FOREIGN KEY([PassphraseCredentialId])
REFERENCES [dbo].[RemoteCredentials] ([Id])
ON DELETE SET NULL
GO
ALTER TABLE [dbo].[RemoteSSHKeys] CHECK CONSTRAINT [FK_RemoteSSHKeys_PassphraseCredential]
GO
ALTER TABLE [dbo].[RemoteSupportSessions]  WITH CHECK ADD  CONSTRAINT [FK_RemoteSupportSessions_Device] FOREIGN KEY([DeviceId])
REFERENCES [dbo].[Devices] ([DeviceId])
GO
ALTER TABLE [dbo].[RemoteSupportSessions] CHECK CONSTRAINT [FK_RemoteSupportSessions_Device]
GO
ALTER TABLE [dbo].[RemoteSupportSessions]  WITH CHECK ADD  CONSTRAINT [FK_RemoteSupportSessions_User] FOREIGN KEY([RequestedByUserId])
REFERENCES [dbo].[Users] ([Id])
GO
ALTER TABLE [dbo].[RemoteSupportSessions] CHECK CONSTRAINT [FK_RemoteSupportSessions_User]
GO
ALTER TABLE [dbo].[RepoConnections]  WITH CHECK ADD  CONSTRAINT [FK_RepoConnections_CreatedBy] FOREIGN KEY([CreatedByUserId])
REFERENCES [dbo].[Users] ([Id])
GO
ALTER TABLE [dbo].[RepoConnections] CHECK CONSTRAINT [FK_RepoConnections_CreatedBy]
GO
ALTER TABLE [dbo].[RoleMenuAccess]  WITH CHECK ADD FOREIGN KEY([RoleId])
REFERENCES [dbo].[Roles] ([Id])
ON DELETE CASCADE
GO
ALTER TABLE [dbo].[RolePermissions]  WITH CHECK ADD  CONSTRAINT [FK_RolePermissions_Roles] FOREIGN KEY([RoleId])
REFERENCES [dbo].[Roles] ([Id])
GO
ALTER TABLE [dbo].[RolePermissions] CHECK CONSTRAINT [FK_RolePermissions_Roles]
GO
ALTER TABLE [dbo].[ScheduledReportContacts]  WITH CHECK ADD FOREIGN KEY([AlertContactId])
REFERENCES [dbo].[AlertContacts] ([Id])
ON DELETE CASCADE
GO
ALTER TABLE [dbo].[ScheduledReportContacts]  WITH CHECK ADD FOREIGN KEY([ScheduledReportId])
REFERENCES [dbo].[ScheduledReports] ([Id])
ON DELETE CASCADE
GO
ALTER TABLE [dbo].[ScheduledReportMonitors]  WITH CHECK ADD FOREIGN KEY([MonitorId])
REFERENCES [dbo].[Monitors] ([Id])
ON DELETE CASCADE
GO
ALTER TABLE [dbo].[ScheduledReportMonitors]  WITH CHECK ADD FOREIGN KEY([ScheduledReportId])
REFERENCES [dbo].[ScheduledReports] ([Id])
ON DELETE CASCADE
GO
ALTER TABLE [dbo].[ScreenshotAuditLog]  WITH CHECK ADD  CONSTRAINT [FK_ScreenshotAuditLog_Screenshots] FOREIGN KEY([ScreenshotId])
REFERENCES [dbo].[Screenshots] ([Id])
GO
ALTER TABLE [dbo].[ScreenshotAuditLog] CHECK CONSTRAINT [FK_ScreenshotAuditLog_Screenshots]
GO
ALTER TABLE [dbo].[Screenshots]  WITH CHECK ADD  CONSTRAINT [FK_Screenshots_Devices] FOREIGN KEY([DeviceId])
REFERENCES [dbo].[Devices] ([DeviceId])
GO
ALTER TABLE [dbo].[Screenshots] CHECK CONSTRAINT [FK_Screenshots_Devices]
GO
ALTER TABLE [dbo].[SecurityAlertNotes]  WITH CHECK ADD  CONSTRAINT [FK_SecurityAlertNotes_Alert] FOREIGN KEY([AlertId])
REFERENCES [dbo].[SecurityAlerts] ([Id])
ON DELETE CASCADE
GO
ALTER TABLE [dbo].[SecurityAlertNotes] CHECK CONSTRAINT [FK_SecurityAlertNotes_Alert]
GO
ALTER TABLE [dbo].[SecurityAlerts]  WITH CHECK ADD  CONSTRAINT [FK_SecurityAlerts_App] FOREIGN KEY([ProtectedApplicationId])
REFERENCES [dbo].[SecurityProtectedApplications] ([Id])
GO
ALTER TABLE [dbo].[SecurityAlerts] CHECK CONSTRAINT [FK_SecurityAlerts_App]
GO
ALTER TABLE [dbo].[SecurityAlerts]  WITH CHECK ADD  CONSTRAINT [FK_SecurityAlerts_Rule] FOREIGN KEY([RuleId])
REFERENCES [dbo].[SecurityDetectionRules] ([Id])
ON DELETE SET NULL
GO
ALTER TABLE [dbo].[SecurityAlerts] CHECK CONSTRAINT [FK_SecurityAlerts_Rule]
GO
ALTER TABLE [dbo].[SecurityAlertStatusHistory]  WITH CHECK ADD  CONSTRAINT [FK_SecurityAlertStatusHistory_Alert] FOREIGN KEY([AlertId])
REFERENCES [dbo].[SecurityAlerts] ([Id])
ON DELETE CASCADE
GO
ALTER TABLE [dbo].[SecurityAlertStatusHistory] CHECK CONSTRAINT [FK_SecurityAlertStatusHistory_Alert]
GO
ALTER TABLE [dbo].[SecurityCollectorHealth]  WITH CHECK ADD  CONSTRAINT [FK_SecurityCollectorHealth_LogSource] FOREIGN KEY([LogSourceId])
REFERENCES [dbo].[SecurityLogSources] ([Id])
ON DELETE CASCADE
GO
ALTER TABLE [dbo].[SecurityCollectorHealth] CHECK CONSTRAINT [FK_SecurityCollectorHealth_LogSource]
GO
ALTER TABLE [dbo].[SecurityEvents]  WITH CHECK ADD  CONSTRAINT [FK_SecurityEvents_Alert] FOREIGN KEY([AlertId])
REFERENCES [dbo].[SecurityAlerts] ([Id])
ON DELETE SET NULL
GO
ALTER TABLE [dbo].[SecurityEvents] CHECK CONSTRAINT [FK_SecurityEvents_Alert]
GO
ALTER TABLE [dbo].[SecurityEvents]  WITH CHECK ADD  CONSTRAINT [FK_SecurityEvents_App] FOREIGN KEY([ProtectedApplicationId])
REFERENCES [dbo].[SecurityProtectedApplications] ([Id])
GO
ALTER TABLE [dbo].[SecurityEvents] CHECK CONSTRAINT [FK_SecurityEvents_App]
GO
ALTER TABLE [dbo].[SecurityEvents]  WITH CHECK ADD  CONSTRAINT [FK_SecurityEvents_LogSource] FOREIGN KEY([LogSourceId])
REFERENCES [dbo].[SecurityLogSources] ([Id])
ON DELETE SET NULL
GO
ALTER TABLE [dbo].[SecurityEvents] CHECK CONSTRAINT [FK_SecurityEvents_LogSource]
GO
ALTER TABLE [dbo].[SecurityHeaderScans]  WITH CHECK ADD  CONSTRAINT [FK_SecurityHeaderScans_Websites] FOREIGN KEY([WebsiteId])
REFERENCES [dbo].[Websites] ([Id])
ON DELETE SET NULL
GO
ALTER TABLE [dbo].[SecurityHeaderScans] CHECK CONSTRAINT [FK_SecurityHeaderScans_Websites]
GO
ALTER TABLE [dbo].[SecurityLogSources]  WITH CHECK ADD  CONSTRAINT [FK_SecurityLogSources_App] FOREIGN KEY([ProtectedApplicationId])
REFERENCES [dbo].[SecurityProtectedApplications] ([Id])
ON DELETE CASCADE
GO
ALTER TABLE [dbo].[SecurityLogSources] CHECK CONSTRAINT [FK_SecurityLogSources_App]
GO
ALTER TABLE [dbo].[SecurityNotificationDeliveries]  WITH CHECK ADD  CONSTRAINT [FK_SecurityNotificationDeliveries_Alert] FOREIGN KEY([AlertId])
REFERENCES [dbo].[SecurityAlerts] ([Id])
ON DELETE SET NULL
GO
ALTER TABLE [dbo].[SecurityNotificationDeliveries] CHECK CONSTRAINT [FK_SecurityNotificationDeliveries_Alert]
GO
ALTER TABLE [dbo].[SecurityNotificationDeliveries]  WITH CHECK ADD  CONSTRAINT [FK_SecurityNotificationDeliveries_Channel] FOREIGN KEY([ChannelId])
REFERENCES [dbo].[SecurityNotificationChannels] ([Id])
ON DELETE SET NULL
GO
ALTER TABLE [dbo].[SecurityNotificationDeliveries] CHECK CONSTRAINT [FK_SecurityNotificationDeliveries_Channel]
GO
ALTER TABLE [dbo].[SecurityProtectedApplications]  WITH CHECK ADD  CONSTRAINT [FK_SecurityProtectedApplications_Website] FOREIGN KEY([WebsiteId])
REFERENCES [dbo].[Websites] ([Id])
ON DELETE SET NULL
GO
ALTER TABLE [dbo].[SecurityProtectedApplications] CHECK CONSTRAINT [FK_SecurityProtectedApplications_Website]
GO
ALTER TABLE [dbo].[SecurityResponseActions]  WITH CHECK ADD  CONSTRAINT [FK_SecurityResponseActions_Alert] FOREIGN KEY([AlertId])
REFERENCES [dbo].[SecurityAlerts] ([Id])
ON DELETE SET NULL
GO
ALTER TABLE [dbo].[SecurityResponseActions] CHECK CONSTRAINT [FK_SecurityResponseActions_Alert]
GO
ALTER TABLE [dbo].[SecurityRuleExclusions]  WITH CHECK ADD  CONSTRAINT [FK_SecurityRuleExclusions_Rule] FOREIGN KEY([RuleId])
REFERENCES [dbo].[SecurityDetectionRules] ([Id])
ON DELETE CASCADE
GO
ALTER TABLE [dbo].[SecurityRuleExclusions] CHECK CONSTRAINT [FK_SecurityRuleExclusions_Rule]
GO
ALTER TABLE [dbo].[SeoScans]  WITH CHECK ADD  CONSTRAINT [FK_SeoScans_Websites] FOREIGN KEY([WebsiteId])
REFERENCES [dbo].[Websites] ([Id])
ON DELETE SET NULL
GO
ALTER TABLE [dbo].[SeoScans] CHECK CONSTRAINT [FK_SeoScans_Websites]
GO
ALTER TABLE [dbo].[ServerLogEntries]  WITH CHECK ADD  CONSTRAINT [FK_ServerLogEntries_Devices] FOREIGN KEY([DeviceId])
REFERENCES [dbo].[Devices] ([DeviceId])
GO
ALTER TABLE [dbo].[ServerLogEntries] CHECK CONSTRAINT [FK_ServerLogEntries_Devices]
GO
ALTER TABLE [dbo].[SlaConfigurations]  WITH CHECK ADD FOREIGN KEY([MonitorId])
REFERENCES [dbo].[Monitors] ([Id])
ON DELETE CASCADE
GO
ALTER TABLE [dbo].[SoftwareInventory]  WITH CHECK ADD FOREIGN KEY([AssetId])
REFERENCES [dbo].[Assets] ([Id])
ON DELETE CASCADE
GO
ALTER TABLE [dbo].[SqlServerActiveSessions]  WITH CHECK ADD  CONSTRAINT [FK_SqlServerActiveSessions_Instance] FOREIGN KEY([InstanceId])
REFERENCES [dbo].[SqlServerInstances] ([Id])
GO
ALTER TABLE [dbo].[SqlServerActiveSessions] CHECK CONSTRAINT [FK_SqlServerActiveSessions_Instance]
GO
ALTER TABLE [dbo].[SqlServerBlockingEvents]  WITH CHECK ADD  CONSTRAINT [FK_SqlServerBlockingEvents_Instance] FOREIGN KEY([InstanceId])
REFERENCES [dbo].[SqlServerInstances] ([Id])
GO
ALTER TABLE [dbo].[SqlServerBlockingEvents] CHECK CONSTRAINT [FK_SqlServerBlockingEvents_Instance]
GO
ALTER TABLE [dbo].[SqlServerDatabaseSnapshots]  WITH CHECK ADD  CONSTRAINT [FK_SqlServerDatabaseSnapshots_Instance] FOREIGN KEY([InstanceId])
REFERENCES [dbo].[SqlServerInstances] ([Id])
GO
ALTER TABLE [dbo].[SqlServerDatabaseSnapshots] CHECK CONSTRAINT [FK_SqlServerDatabaseSnapshots_Instance]
GO
ALTER TABLE [dbo].[SqlServerDeadlockEvents]  WITH CHECK ADD  CONSTRAINT [FK_SqlServerDeadlockEvents_Instance] FOREIGN KEY([InstanceId])
REFERENCES [dbo].[SqlServerInstances] ([Id])
GO
ALTER TABLE [dbo].[SqlServerDeadlockEvents] CHECK CONSTRAINT [FK_SqlServerDeadlockEvents_Instance]
GO
ALTER TABLE [dbo].[SqlServerMetricsSnapshots]  WITH CHECK ADD  CONSTRAINT [FK_SqlServerMetricsSnapshots_Instance] FOREIGN KEY([InstanceId])
REFERENCES [dbo].[SqlServerInstances] ([Id])
GO
ALTER TABLE [dbo].[SqlServerMetricsSnapshots] CHECK CONSTRAINT [FK_SqlServerMetricsSnapshots_Instance]
GO
ALTER TABLE [dbo].[SqlServerSlowQueries]  WITH CHECK ADD  CONSTRAINT [FK_SqlServerSlowQueries_Instance] FOREIGN KEY([InstanceId])
REFERENCES [dbo].[SqlServerInstances] ([Id])
GO
ALTER TABLE [dbo].[SqlServerSlowQueries] CHECK CONSTRAINT [FK_SqlServerSlowQueries_Instance]
GO
ALTER TABLE [dbo].[SslCertificateRecords]  WITH CHECK ADD FOREIGN KEY([MonitorId])
REFERENCES [dbo].[Monitors] ([Id])
ON DELETE CASCADE
GO
ALTER TABLE [dbo].[Staff]  WITH CHECK ADD FOREIGN KEY([WacGroupId])
REFERENCES [dbo].[WacGroups] ([Id])
GO
ALTER TABLE [dbo].[Staff]  WITH CHECK ADD  CONSTRAINT [FK_Staff_BranchOffices] FOREIGN KEY([BranchOfficeId])
REFERENCES [dbo].[BranchOffices] ([Id])
GO
ALTER TABLE [dbo].[Staff] CHECK CONSTRAINT [FK_Staff_BranchOffices]
GO
ALTER TABLE [dbo].[Staff]  WITH CHECK ADD  CONSTRAINT [FK_Staff_Departments] FOREIGN KEY([DepartmentId])
REFERENCES [dbo].[Departments] ([Id])
GO
ALTER TABLE [dbo].[Staff] CHECK CONSTRAINT [FK_Staff_Departments]
GO
ALTER TABLE [dbo].[Staff]  WITH CHECK ADD  CONSTRAINT [FK_Staff_JobDesignations] FOREIGN KEY([JobDesignationId])
REFERENCES [dbo].[JobDesignations] ([Id])
GO
ALTER TABLE [dbo].[Staff] CHECK CONSTRAINT [FK_Staff_JobDesignations]
GO
ALTER TABLE [dbo].[Staff]  WITH CHECK ADD  CONSTRAINT [FK_Staff_Teams] FOREIGN KEY([TeamId])
REFERENCES [dbo].[Teams] ([Id])
GO
ALTER TABLE [dbo].[Staff] CHECK CONSTRAINT [FK_Staff_Teams]
GO
ALTER TABLE [dbo].[SupportTicketNotes]  WITH CHECK ADD  CONSTRAINT [FK_SupportTicketNotes_Tickets] FOREIGN KEY([TicketId])
REFERENCES [dbo].[SupportTickets] ([Id])
GO
ALTER TABLE [dbo].[SupportTicketNotes] CHECK CONSTRAINT [FK_SupportTicketNotes_Tickets]
GO
ALTER TABLE [dbo].[Teams]  WITH CHECK ADD  CONSTRAINT [FK_Teams_Departments] FOREIGN KEY([DepartmentId])
REFERENCES [dbo].[Departments] ([Id])
GO
ALTER TABLE [dbo].[Teams] CHECK CONSTRAINT [FK_Teams_Departments]
GO
ALTER TABLE [dbo].[ThreatScans]  WITH CHECK ADD  CONSTRAINT [FK_ThreatScans_Websites] FOREIGN KEY([WebsiteId])
REFERENCES [dbo].[Websites] ([Id])
ON DELETE SET NULL
GO
ALTER TABLE [dbo].[ThreatScans] CHECK CONSTRAINT [FK_ThreatScans_Websites]
GO
ALTER TABLE [dbo].[UserGroupMembers]  WITH CHECK ADD  CONSTRAINT [FK_UserGroupMembers_Groups] FOREIGN KEY([GroupId])
REFERENCES [dbo].[UserGroups] ([Id])
GO
ALTER TABLE [dbo].[UserGroupMembers] CHECK CONSTRAINT [FK_UserGroupMembers_Groups]
GO
ALTER TABLE [dbo].[UserGroupMembers]  WITH CHECK ADD  CONSTRAINT [FK_UserGroupMembers_Users] FOREIGN KEY([UserId])
REFERENCES [dbo].[Users] ([Id])
GO
ALTER TABLE [dbo].[UserGroupMembers] CHECK CONSTRAINT [FK_UserGroupMembers_Users]
GO
ALTER TABLE [dbo].[UserMenuAccess]  WITH CHECK ADD FOREIGN KEY([UserId])
REFERENCES [dbo].[Users] ([Id])
ON DELETE CASCADE
GO
ALTER TABLE [dbo].[UserPasskeys]  WITH CHECK ADD  CONSTRAINT [FK_UserPasskeys_Users] FOREIGN KEY([UserId])
REFERENCES [dbo].[Users] ([Id])
ON DELETE CASCADE
GO
ALTER TABLE [dbo].[UserPasskeys] CHECK CONSTRAINT [FK_UserPasskeys_Users]
GO
ALTER TABLE [dbo].[UserTotpRecoveryCodes]  WITH CHECK ADD  CONSTRAINT [FK_UserTotpRecoveryCodes_Users] FOREIGN KEY([UserId])
REFERENCES [dbo].[Users] ([Id])
ON DELETE CASCADE
GO
ALTER TABLE [dbo].[UserTotpRecoveryCodes] CHECK CONSTRAINT [FK_UserTotpRecoveryCodes_Users]
GO
ALTER TABLE [dbo].[VulnerabilityFindings]  WITH CHECK ADD FOREIGN KEY([ScanId])
REFERENCES [dbo].[VulnerabilityScans] ([Id])
ON DELETE CASCADE
GO
ALTER TABLE [dbo].[VulnerabilityScans]  WITH CHECK ADD FOREIGN KEY([WebsiteId])
REFERENCES [dbo].[Websites] ([Id])
GO
ALTER TABLE [dbo].[WacWebsiteRules]  WITH CHECK ADD FOREIGN KEY([ScheduleId])
REFERENCES [dbo].[WacSchedules] ([Id])
GO
ALTER TABLE [dbo].[WacWebsiteRules]  WITH CHECK ADD FOREIGN KEY([StaffId])
REFERENCES [dbo].[Staff] ([Id])
GO
ALTER TABLE [dbo].[WacWebsiteRules]  WITH CHECK ADD FOREIGN KEY([WacGroupId])
REFERENCES [dbo].[WacGroups] ([Id])
GO
ALTER TABLE [dbo].[WafApplications]  WITH CHECK ADD  CONSTRAINT [FK_WafApplications_CreatedBy] FOREIGN KEY([CreatedByUserId])
REFERENCES [dbo].[Users] ([Id])
GO
ALTER TABLE [dbo].[WafApplications] CHECK CONSTRAINT [FK_WafApplications_CreatedBy]
GO
ALTER TABLE [dbo].[WafAttackEvents]  WITH CHECK ADD  CONSTRAINT [FK_WafAttackEvents_Application] FOREIGN KEY([ApplicationId])
REFERENCES [dbo].[WafApplications] ([Id])
GO
ALTER TABLE [dbo].[WafAttackEvents] CHECK CONSTRAINT [FK_WafAttackEvents_Application]
GO
ALTER TABLE [dbo].[WafAttackEvents]  WITH CHECK ADD  CONSTRAINT [FK_WafAttackEvents_Rule] FOREIGN KEY([RuleId])
REFERENCES [dbo].[WafRules] ([Id])
GO
ALTER TABLE [dbo].[WafAttackEvents] CHECK CONSTRAINT [FK_WafAttackEvents_Rule]
GO
ALTER TABLE [dbo].[WafHealthChecks]  WITH CHECK ADD  CONSTRAINT [FK_WafHealthChecks_Application] FOREIGN KEY([ApplicationId])
REFERENCES [dbo].[WafApplications] ([Id])
GO
ALTER TABLE [dbo].[WafHealthChecks] CHECK CONSTRAINT [FK_WafHealthChecks_Application]
GO
ALTER TABLE [dbo].[WafIpRules]  WITH CHECK ADD  CONSTRAINT [FK_WafIpRules_CreatedBy] FOREIGN KEY([CreatedByUserId])
REFERENCES [dbo].[Users] ([Id])
GO
ALTER TABLE [dbo].[WafIpRules] CHECK CONSTRAINT [FK_WafIpRules_CreatedBy]
GO
ALTER TABLE [dbo].[WafRateLimitRules]  WITH CHECK ADD FOREIGN KEY([WebsiteId])
REFERENCES [dbo].[Websites] ([Id])
GO
ALTER TABLE [dbo].[WafRateLimits]  WITH CHECK ADD  CONSTRAINT [FK_WafRateLimits_Application] FOREIGN KEY([ApplicationId])
REFERENCES [dbo].[WafApplications] ([Id])
GO
ALTER TABLE [dbo].[WafRateLimits] CHECK CONSTRAINT [FK_WafRateLimits_Application]
GO
ALTER TABLE [dbo].[WafRateLimits]  WITH CHECK ADD  CONSTRAINT [FK_WafRateLimits_CreatedBy] FOREIGN KEY([CreatedByUserId])
REFERENCES [dbo].[Users] ([Id])
GO
ALTER TABLE [dbo].[WafRateLimits] CHECK CONSTRAINT [FK_WafRateLimits_CreatedBy]
GO
ALTER TABLE [dbo].[WafRequestLogs]  WITH CHECK ADD  CONSTRAINT [FK_WafRequestLogs_Application] FOREIGN KEY([ApplicationId])
REFERENCES [dbo].[WafApplications] ([Id])
GO
ALTER TABLE [dbo].[WafRequestLogs] CHECK CONSTRAINT [FK_WafRequestLogs_Application]
GO
ALTER TABLE [dbo].[WafRuleExceptions]  WITH CHECK ADD  CONSTRAINT [FK_WafRuleExceptions_Application] FOREIGN KEY([ApplicationId])
REFERENCES [dbo].[WafApplications] ([Id])
GO
ALTER TABLE [dbo].[WafRuleExceptions] CHECK CONSTRAINT [FK_WafRuleExceptions_Application]
GO
ALTER TABLE [dbo].[WafRuleExceptions]  WITH CHECK ADD  CONSTRAINT [FK_WafRuleExceptions_CreatedBy] FOREIGN KEY([CreatedByUserId])
REFERENCES [dbo].[Users] ([Id])
GO
ALTER TABLE [dbo].[WafRuleExceptions] CHECK CONSTRAINT [FK_WafRuleExceptions_CreatedBy]
GO
ALTER TABLE [dbo].[WafRuleExceptions]  WITH CHECK ADD  CONSTRAINT [FK_WafRuleExceptions_Rule] FOREIGN KEY([RuleId])
REFERENCES [dbo].[WafRules] ([Id])
GO
ALTER TABLE [dbo].[WafRuleExceptions] CHECK CONSTRAINT [FK_WafRuleExceptions_Rule]
GO
ALTER TABLE [dbo].[WafRules]  WITH CHECK ADD  CONSTRAINT [FK_WafRules_Application] FOREIGN KEY([ApplicationId])
REFERENCES [dbo].[WafApplications] ([Id])
GO
ALTER TABLE [dbo].[WafRules] CHECK CONSTRAINT [FK_WafRules_Application]
GO
ALTER TABLE [dbo].[WafRules]  WITH CHECK ADD  CONSTRAINT [FK_WafRules_CreatedBy] FOREIGN KEY([CreatedByUserId])
REFERENCES [dbo].[Users] ([Id])
GO
ALTER TABLE [dbo].[WafRules] CHECK CONSTRAINT [FK_WafRules_CreatedBy]
GO
ALTER TABLE [dbo].[WatchedFiles]  WITH CHECK ADD  CONSTRAINT [FK_WatchedFiles_Devices] FOREIGN KEY([DeviceId])
REFERENCES [dbo].[Devices] ([DeviceId])
GO
ALTER TABLE [dbo].[WatchedFiles] CHECK CONSTRAINT [FK_WatchedFiles_Devices]
GO
ALTER TABLE [dbo].[WazuhOfficeAgentVulnerabilities]  WITH CHECK ADD  CONSTRAINT [FK_WOAgentVulns_Device] FOREIGN KEY([DeviceId])
REFERENCES [dbo].[Devices] ([DeviceId])
GO
ALTER TABLE [dbo].[WazuhOfficeAgentVulnerabilities] CHECK CONSTRAINT [FK_WOAgentVulns_Device]
GO
ALTER TABLE [dbo].[WazuhOfficeAgentVulnerabilities]  WITH CHECK ADD  CONSTRAINT [FK_WOAgentVulns_Vuln] FOREIGN KEY([VulnerabilityId])
REFERENCES [dbo].[WazuhOfficeVulnerabilities] ([Id])
GO
ALTER TABLE [dbo].[WazuhOfficeAgentVulnerabilities] CHECK CONSTRAINT [FK_WOAgentVulns_Vuln]
GO
ALTER TABLE [dbo].[WazuhOfficeAlertComments]  WITH CHECK ADD  CONSTRAINT [FK_WOAlertComments_Alert] FOREIGN KEY([AlertId])
REFERENCES [dbo].[WazuhOfficeAlerts] ([Id])
GO
ALTER TABLE [dbo].[WazuhOfficeAlertComments] CHECK CONSTRAINT [FK_WOAlertComments_Alert]
GO
ALTER TABLE [dbo].[WazuhOfficeAlertComments]  WITH CHECK ADD  CONSTRAINT [FK_WOAlertComments_User] FOREIGN KEY([UserId])
REFERENCES [dbo].[Users] ([Id])
GO
ALTER TABLE [dbo].[WazuhOfficeAlertComments] CHECK CONSTRAINT [FK_WOAlertComments_User]
GO
ALTER TABLE [dbo].[WazuhOfficeAlerts]  WITH CHECK ADD  CONSTRAINT [FK_WOAlerts_Analyst] FOREIGN KEY([AssignedAnalystUserId])
REFERENCES [dbo].[Users] ([Id])
GO
ALTER TABLE [dbo].[WazuhOfficeAlerts] CHECK CONSTRAINT [FK_WOAlerts_Analyst]
GO
ALTER TABLE [dbo].[WazuhOfficeAlerts]  WITH CHECK ADD  CONSTRAINT [FK_WOAlerts_Device] FOREIGN KEY([DeviceId])
REFERENCES [dbo].[Devices] ([DeviceId])
GO
ALTER TABLE [dbo].[WazuhOfficeAlerts] CHECK CONSTRAINT [FK_WOAlerts_Device]
GO
ALTER TABLE [dbo].[WazuhOfficeAlerts]  WITH CHECK ADD  CONSTRAINT [FK_WOAlerts_Event] FOREIGN KEY([SecurityEventId])
REFERENCES [dbo].[WazuhOfficeSecurityEvents] ([Id])
GO
ALTER TABLE [dbo].[WazuhOfficeAlerts] CHECK CONSTRAINT [FK_WOAlerts_Event]
GO
ALTER TABLE [dbo].[WazuhOfficeAlerts]  WITH CHECK ADD  CONSTRAINT [FK_WOAlerts_Rule] FOREIGN KEY([RuleId])
REFERENCES [dbo].[WazuhOfficeRules] ([Id])
GO
ALTER TABLE [dbo].[WazuhOfficeAlerts] CHECK CONSTRAINT [FK_WOAlerts_Rule]
GO
ALTER TABLE [dbo].[WazuhOfficeCpuMetrics]  WITH CHECK ADD  CONSTRAINT [FK_WOCpuMetrics_Device] FOREIGN KEY([DeviceId])
REFERENCES [dbo].[Devices] ([DeviceId])
GO
ALTER TABLE [dbo].[WazuhOfficeCpuMetrics] CHECK CONSTRAINT [FK_WOCpuMetrics_Device]
GO
ALTER TABLE [dbo].[WazuhOfficeDiskMetrics]  WITH CHECK ADD  CONSTRAINT [FK_WODiskMetrics_Device] FOREIGN KEY([DeviceId])
REFERENCES [dbo].[Devices] ([DeviceId])
GO
ALTER TABLE [dbo].[WazuhOfficeDiskMetrics] CHECK CONSTRAINT [FK_WODiskMetrics_Device]
GO
ALTER TABLE [dbo].[WazuhOfficeFileIntegrityEvents]  WITH CHECK ADD  CONSTRAINT [FK_WOFimEvents_Device] FOREIGN KEY([DeviceId])
REFERENCES [dbo].[Devices] ([DeviceId])
GO
ALTER TABLE [dbo].[WazuhOfficeFileIntegrityEvents] CHECK CONSTRAINT [FK_WOFimEvents_Device]
GO
ALTER TABLE [dbo].[WazuhOfficeInventorySnapshots]  WITH CHECK ADD  CONSTRAINT [FK_WOInventory_Device] FOREIGN KEY([DeviceId])
REFERENCES [dbo].[Devices] ([DeviceId])
GO
ALTER TABLE [dbo].[WazuhOfficeInventorySnapshots] CHECK CONSTRAINT [FK_WOInventory_Device]
GO
ALTER TABLE [dbo].[WazuhOfficeMemoryMetrics]  WITH CHECK ADD  CONSTRAINT [FK_WOMemMetrics_Device] FOREIGN KEY([DeviceId])
REFERENCES [dbo].[Devices] ([DeviceId])
GO
ALTER TABLE [dbo].[WazuhOfficeMemoryMetrics] CHECK CONSTRAINT [FK_WOMemMetrics_Device]
GO
ALTER TABLE [dbo].[WazuhOfficeMitreTechniques]  WITH CHECK ADD  CONSTRAINT [FK_WOMitreTechniques_Tactic] FOREIGN KEY([TacticId])
REFERENCES [dbo].[WazuhOfficeMitreTactics] ([TacticId])
GO
ALTER TABLE [dbo].[WazuhOfficeMitreTechniques] CHECK CONSTRAINT [FK_WOMitreTechniques_Tactic]
GO
ALTER TABLE [dbo].[WazuhOfficeNetworkConnections]  WITH CHECK ADD  CONSTRAINT [FK_WONetConn_Device] FOREIGN KEY([DeviceId])
REFERENCES [dbo].[Devices] ([DeviceId])
GO
ALTER TABLE [dbo].[WazuhOfficeNetworkConnections] CHECK CONSTRAINT [FK_WONetConn_Device]
GO
ALTER TABLE [dbo].[WazuhOfficeNotificationCooldowns]  WITH CHECK ADD  CONSTRAINT [FK_WONotifCooldown_Device] FOREIGN KEY([DeviceId])
REFERENCES [dbo].[Devices] ([DeviceId])
GO
ALTER TABLE [dbo].[WazuhOfficeNotificationCooldowns] CHECK CONSTRAINT [FK_WONotifCooldown_Device]
GO
ALTER TABLE [dbo].[WazuhOfficeNotificationCooldowns]  WITH CHECK ADD  CONSTRAINT [FK_WONotifCooldown_Rule] FOREIGN KEY([RuleId])
REFERENCES [dbo].[WazuhOfficeRules] ([Id])
GO
ALTER TABLE [dbo].[WazuhOfficeNotificationCooldowns] CHECK CONSTRAINT [FK_WONotifCooldown_Rule]
GO
ALTER TABLE [dbo].[WazuhOfficeProcesses]  WITH CHECK ADD  CONSTRAINT [FK_WOProcesses_Device] FOREIGN KEY([DeviceId])
REFERENCES [dbo].[Devices] ([DeviceId])
GO
ALTER TABLE [dbo].[WazuhOfficeProcesses] CHECK CONSTRAINT [FK_WOProcesses_Device]
GO
ALTER TABLE [dbo].[WazuhOfficeRules]  WITH CHECK ADD  CONSTRAINT [FK_WORules_CreatedBy] FOREIGN KEY([CreatedByUserId])
REFERENCES [dbo].[Users] ([Id])
GO
ALTER TABLE [dbo].[WazuhOfficeRules] CHECK CONSTRAINT [FK_WORules_CreatedBy]
GO
ALTER TABLE [dbo].[WazuhOfficeSecurityEvents]  WITH CHECK ADD  CONSTRAINT [FK_WOSecurityEvents_Device] FOREIGN KEY([DeviceId])
REFERENCES [dbo].[Devices] ([DeviceId])
GO
ALTER TABLE [dbo].[WazuhOfficeSecurityEvents] CHECK CONSTRAINT [FK_WOSecurityEvents_Device]
GO
ALTER TABLE [dbo].[WazuhOfficeSecurityEvents]  WITH CHECK ADD  CONSTRAINT [FK_WOSecurityEvents_Rule] FOREIGN KEY([RuleId])
REFERENCES [dbo].[WazuhOfficeRules] ([Id])
GO
ALTER TABLE [dbo].[WazuhOfficeSecurityEvents] CHECK CONSTRAINT [FK_WOSecurityEvents_Rule]
GO
ALTER TABLE [dbo].[WazuhOfficeServices]  WITH CHECK ADD  CONSTRAINT [FK_WOServices_Device] FOREIGN KEY([DeviceId])
REFERENCES [dbo].[Devices] ([DeviceId])
GO
ALTER TABLE [dbo].[WazuhOfficeServices] CHECK CONSTRAINT [FK_WOServices_Device]
GO
ALTER TABLE [dbo].[WazuhOfficeTemperatureMetrics]  WITH CHECK ADD  CONSTRAINT [FK_WOTempMetrics_Device] FOREIGN KEY([DeviceId])
REFERENCES [dbo].[Devices] ([DeviceId])
GO
ALTER TABLE [dbo].[WazuhOfficeTemperatureMetrics] CHECK CONSTRAINT [FK_WOTempMetrics_Device]
GO
ALTER TABLE [dbo].[WazuhOfficeWatchedPaths]  WITH CHECK ADD  CONSTRAINT [FK_WOWatchedPaths_CreatedBy] FOREIGN KEY([CreatedByUserId])
REFERENCES [dbo].[Users] ([Id])
GO
ALTER TABLE [dbo].[WazuhOfficeWatchedPaths] CHECK CONSTRAINT [FK_WOWatchedPaths_CreatedBy]
GO
ALTER TABLE [dbo].[WazuhOfficeWatchedPaths]  WITH CHECK ADD  CONSTRAINT [FK_WOWatchedPaths_Device] FOREIGN KEY([DeviceId])
REFERENCES [dbo].[Devices] ([DeviceId])
GO
ALTER TABLE [dbo].[WazuhOfficeWatchedPaths] CHECK CONSTRAINT [FK_WOWatchedPaths_Device]
GO
ALTER TABLE [dbo].[WebsiteAuditEmailLogs]  WITH CHECK ADD  CONSTRAINT [FK_WebsiteAuditEmailLogs_Scans] FOREIGN KEY([ScanId])
REFERENCES [dbo].[WebsiteAuditScans] ([Id])
ON DELETE CASCADE
GO
ALTER TABLE [dbo].[WebsiteAuditEmailLogs] CHECK CONSTRAINT [FK_WebsiteAuditEmailLogs_Scans]
GO
ALTER TABLE [dbo].[WebsiteAuditFindings]  WITH CHECK ADD  CONSTRAINT [FK_WebsiteAuditFindings_Scans] FOREIGN KEY([ScanId])
REFERENCES [dbo].[WebsiteAuditScans] ([Id])
ON DELETE CASCADE
GO
ALTER TABLE [dbo].[WebsiteAuditFindings] CHECK CONSTRAINT [FK_WebsiteAuditFindings_Scans]
GO
ALTER TABLE [dbo].[WebsiteAuditReports]  WITH CHECK ADD  CONSTRAINT [FK_WebsiteAuditReports_Scans] FOREIGN KEY([ScanId])
REFERENCES [dbo].[WebsiteAuditScans] ([Id])
ON DELETE CASCADE
GO
ALTER TABLE [dbo].[WebsiteAuditReports] CHECK CONSTRAINT [FK_WebsiteAuditReports_Scans]
GO
ALTER TABLE [dbo].[WebsiteAuditScanLog]  WITH CHECK ADD  CONSTRAINT [FK_WebsiteAuditScanLog_Scans] FOREIGN KEY([ScanId])
REFERENCES [dbo].[WebsiteAuditScans] ([Id])
ON DELETE CASCADE
GO
ALTER TABLE [dbo].[WebsiteAuditScanLog] CHECK CONSTRAINT [FK_WebsiteAuditScanLog_Scans]
GO
ALTER TABLE [dbo].[WebsiteAuditScans]  WITH CHECK ADD  CONSTRAINT [FK_WebsiteAuditScans_Websites] FOREIGN KEY([WebsiteId])
REFERENCES [dbo].[Websites] ([Id])
ON DELETE CASCADE
GO
ALTER TABLE [dbo].[WebsiteAuditScans] CHECK CONSTRAINT [FK_WebsiteAuditScans_Websites]
GO
ALTER TABLE [dbo].[WebsiteAuditSourceInputs]  WITH CHECK ADD  CONSTRAINT [FK_WebsiteAuditSourceInputs_Websites] FOREIGN KEY([WebsiteId])
REFERENCES [dbo].[Websites] ([Id])
ON DELETE CASCADE
GO
ALTER TABLE [dbo].[WebsiteAuditSourceInputs] CHECK CONSTRAINT [FK_WebsiteAuditSourceInputs_Websites]
GO
ALTER TABLE [dbo].[WebsiteCodeFindings]  WITH CHECK ADD  CONSTRAINT [FK_WebsiteCodeFindings_Scans] FOREIGN KEY([ScanId])
REFERENCES [dbo].[WebsiteAuditScans] ([Id])
ON DELETE CASCADE
GO
ALTER TABLE [dbo].[WebsiteCodeFindings] CHECK CONSTRAINT [FK_WebsiteCodeFindings_Scans]
GO
ALTER TABLE [dbo].[WebsiteDependencyFindings]  WITH CHECK ADD  CONSTRAINT [FK_WebsiteDependencyFindings_Scans] FOREIGN KEY([ScanId])
REFERENCES [dbo].[WebsiteAuditScans] ([Id])
ON DELETE CASCADE
GO
ALTER TABLE [dbo].[WebsiteDependencyFindings] CHECK CONSTRAINT [FK_WebsiteDependencyFindings_Scans]
GO
ALTER TABLE [dbo].[WebsiteIncidentReports]  WITH CHECK ADD FOREIGN KEY([CreatedByUserId])
REFERENCES [dbo].[Users] ([Id])
GO
ALTER TABLE [dbo].[WebsiteIncidentReports]  WITH CHECK ADD FOREIGN KEY([MonitorId])
REFERENCES [dbo].[Monitors] ([Id])
GO
ALTER TABLE [dbo].[WebsiteMonitorConfigs]  WITH CHECK ADD FOREIGN KEY([MonitorId])
REFERENCES [dbo].[Monitors] ([Id])
ON DELETE CASCADE
GO
ALTER TABLE [dbo].[WebsiteOptimizationChecks]  WITH CHECK ADD  CONSTRAINT [FK_WebsiteOptimizationChecks_Scans] FOREIGN KEY([ScanId])
REFERENCES [dbo].[WebsitePerformanceScans] ([Id])
ON DELETE CASCADE
GO
ALTER TABLE [dbo].[WebsiteOptimizationChecks] CHECK CONSTRAINT [FK_WebsiteOptimizationChecks_Scans]
GO
ALTER TABLE [dbo].[WebsitePerformanceAlerts]  WITH CHECK ADD  CONSTRAINT [FK_WebsitePerformanceAlerts_Websites] FOREIGN KEY([WebsiteId])
REFERENCES [dbo].[Websites] ([Id])
ON DELETE CASCADE
GO
ALTER TABLE [dbo].[WebsitePerformanceAlerts] CHECK CONSTRAINT [FK_WebsitePerformanceAlerts_Websites]
GO
ALTER TABLE [dbo].[WebsitePerformanceConfigs]  WITH CHECK ADD  CONSTRAINT [FK_WebsitePerformanceConfigs_Websites] FOREIGN KEY([WebsiteId])
REFERENCES [dbo].[Websites] ([Id])
ON DELETE CASCADE
GO
ALTER TABLE [dbo].[WebsitePerformanceConfigs] CHECK CONSTRAINT [FK_WebsitePerformanceConfigs_Websites]
GO
ALTER TABLE [dbo].[WebsitePerformanceReports]  WITH CHECK ADD  CONSTRAINT [FK_WebsitePerformanceReports_Websites] FOREIGN KEY([WebsiteId])
REFERENCES [dbo].[Websites] ([Id])
ON DELETE CASCADE
GO
ALTER TABLE [dbo].[WebsitePerformanceReports] CHECK CONSTRAINT [FK_WebsitePerformanceReports_Websites]
GO
ALTER TABLE [dbo].[WebsitePerformanceResourceMetrics]  WITH CHECK ADD  CONSTRAINT [FK_WebsitePerformanceResourceMetrics_Scans] FOREIGN KEY([ScanId])
REFERENCES [dbo].[WebsitePerformanceScans] ([Id])
ON DELETE CASCADE
GO
ALTER TABLE [dbo].[WebsitePerformanceResourceMetrics] CHECK CONSTRAINT [FK_WebsitePerformanceResourceMetrics_Scans]
GO
ALTER TABLE [dbo].[WebsitePerformanceScans]  WITH CHECK ADD  CONSTRAINT [FK_WebsitePerformanceScans_Websites] FOREIGN KEY([WebsiteId])
REFERENCES [dbo].[Websites] ([Id])
ON DELETE CASCADE
GO
ALTER TABLE [dbo].[WebsitePerformanceScans] CHECK CONSTRAINT [FK_WebsitePerformanceScans_Websites]
GO
ALTER TABLE [dbo].[WebsiteScanSchedules]  WITH CHECK ADD  CONSTRAINT [FK_WebsiteScanSchedules_Websites] FOREIGN KEY([WebsiteId])
REFERENCES [dbo].[Websites] ([Id])
ON DELETE CASCADE
GO
ALTER TABLE [dbo].[WebsiteScanSchedules] CHECK CONSTRAINT [FK_WebsiteScanSchedules_Websites]
GO
ALTER TABLE [dbo].[WebsiteSslStatus]  WITH CHECK ADD FOREIGN KEY([WebsiteId])
REFERENCES [dbo].[Websites] ([Id])
ON DELETE CASCADE
GO
ALTER TABLE [dbo].[WifiAllowedDevices]  WITH CHECK ADD FOREIGN KEY([StaffId])
REFERENCES [dbo].[Staff] ([Id])
GO
ALTER TABLE [dbo].[WordPressDeepScans]  WITH CHECK ADD  CONSTRAINT [FK_WordPressDeepScans_Websites] FOREIGN KEY([WebsiteId])
REFERENCES [dbo].[Websites] ([Id])
ON DELETE SET NULL
GO
ALTER TABLE [dbo].[WordPressDeepScans] CHECK CONSTRAINT [FK_WordPressDeepScans_Websites]
GO
ALTER TABLE [dbo].[WordPressFindings]  WITH CHECK ADD  CONSTRAINT [FK_WordPressFindings_Website] FOREIGN KEY([WebsiteId])
REFERENCES [dbo].[Websites] ([Id])
ON DELETE CASCADE
GO
ALTER TABLE [dbo].[WordPressFindings] CHECK CONSTRAINT [FK_WordPressFindings_Website]
GO
ALTER TABLE [dbo].[WordPressFindingStatusHistory]  WITH CHECK ADD  CONSTRAINT [FK_WordPressFindingStatusHistory_Finding] FOREIGN KEY([FindingId])
REFERENCES [dbo].[WordPressFindings] ([Id])
ON DELETE CASCADE
GO
ALTER TABLE [dbo].[WordPressFindingStatusHistory] CHECK CONSTRAINT [FK_WordPressFindingStatusHistory_Finding]
GO
ALTER TABLE [dbo].[WordPressScanSchedules]  WITH CHECK ADD  CONSTRAINT [FK_WordPressScanSchedules_Website] FOREIGN KEY([WebsiteId])
REFERENCES [dbo].[Websites] ([Id])
ON DELETE CASCADE
GO
ALTER TABLE [dbo].[WordPressScanSchedules] CHECK CONSTRAINT [FK_WordPressScanSchedules_Website]
GO
ALTER TABLE [dbo].[AgentRolloutSettings]  WITH CHECK ADD CHECK  (([Id]=(1)))
GO
ALTER TABLE [dbo].[AlertContacts]  WITH CHECK ADD  CONSTRAINT [CK_AlertContacts_Type] CHECK  (([ContactType]='InApp' OR [ContactType]='Webhook' OR [ContactType]='Teams' OR [ContactType]='Slack' OR [ContactType]='Email'))
GO
ALTER TABLE [dbo].[AlertContacts] CHECK CONSTRAINT [CK_AlertContacts_Type]
GO
ALTER TABLE [dbo].[ApiMonitorConfigs]  WITH CHECK ADD  CONSTRAINT [CK_ApiMonitorConfigs_AuthType] CHECK  (([AuthType]='OAuth2ClientCredentials' OR [AuthType]='BasicAuth' OR [AuthType]='BearerToken' OR [AuthType]='ApiKey' OR [AuthType]='None'))
GO
ALTER TABLE [dbo].[ApiMonitorConfigs] CHECK CONSTRAINT [CK_ApiMonitorConfigs_AuthType]
GO
ALTER TABLE [dbo].[Assets]  WITH CHECK ADD  CONSTRAINT [CK_Assets_AssetType] CHECK  (([AssetType]='Other' OR [AssetType]='Printer' OR [AssetType]='StorageDevice' OR [AssetType]='Switch' OR [AssetType]='Router' OR [AssetType]='Firewall' OR [AssetType]='VirtualMachine' OR [AssetType]='Laptop' OR [AssetType]='Desktop' OR [AssetType]='Server'))
GO
ALTER TABLE [dbo].[Assets] CHECK CONSTRAINT [CK_Assets_AssetType]
GO
ALTER TABLE [dbo].[Assets]  WITH CHECK ADD  CONSTRAINT [CK_Assets_Criticality] CHECK  (([Criticality]='Low' OR [Criticality]='Medium' OR [Criticality]='High' OR [Criticality]='Critical'))
GO
ALTER TABLE [dbo].[Assets] CHECK CONSTRAINT [CK_Assets_Criticality]
GO
ALTER TABLE [dbo].[Assets]  WITH CHECK ADD  CONSTRAINT [CK_Assets_Status] CHECK  (([Status]='Spare' OR [Status]='Lost' OR [Status]='Disposed' OR [Status]='Retired' OR [Status]='UnderMaintenance' OR [Status]='Inactive' OR [Status]='Active'))
GO
ALTER TABLE [dbo].[Assets] CHECK CONSTRAINT [CK_Assets_Status]
GO
ALTER TABLE [dbo].[AutomationJobs]  WITH CHECK ADD  CONSTRAINT [CK_AutomationJobs_TriggerType] CHECK  (([TriggerType]='Scheduled' OR [TriggerType]='Manual'))
GO
ALTER TABLE [dbo].[AutomationJobs] CHECK CONSTRAINT [CK_AutomationJobs_TriggerType]
GO
ALTER TABLE [dbo].[AutomationJobTargets]  WITH CHECK ADD  CONSTRAINT [CK_AutomationJobTargets_Status] CHECK  (([Status]='Error' OR [Status]='TimedOut' OR [Status]='Failed' OR [Status]='Success' OR [Status]='Running' OR [Status]='Pending'))
GO
ALTER TABLE [dbo].[AutomationJobTargets] CHECK CONSTRAINT [CK_AutomationJobTargets_Status]
GO
ALTER TABLE [dbo].[AutomationSchedules]  WITH CHECK ADD  CONSTRAINT [CK_AutomationSchedules_Interval] CHECK  (([IntervalMinutes]>=(1)))
GO
ALTER TABLE [dbo].[AutomationSchedules] CHECK CONSTRAINT [CK_AutomationSchedules_Interval]
GO
ALTER TABLE [dbo].[AutomationScripts]  WITH CHECK ADD  CONSTRAINT [CK_AutomationScripts_HasBody] CHECK  (([PowerShellBody] IS NOT NULL OR [BashBody] IS NOT NULL))
GO
ALTER TABLE [dbo].[AutomationScripts] CHECK CONSTRAINT [CK_AutomationScripts_HasBody]
GO
ALTER TABLE [dbo].[BrowserActivityEvents]  WITH CHECK ADD  CONSTRAINT [CK_BrowserActivityEvents_Browser] CHECK  (([Browser]='safari' OR [Browser]='vivaldi' OR [Browser]='opera' OR [Browser]='brave' OR [Browser]='firefox' OR [Browser]='edge' OR [Browser]='chrome'))
GO
ALTER TABLE [dbo].[BrowserActivityEvents] CHECK CONSTRAINT [CK_BrowserActivityEvents_Browser]
GO
ALTER TABLE [dbo].[BrowserActivityEvents]  WITH CHECK ADD  CONSTRAINT [CK_BrowserActivityEvents_RiskLevel] CHECK  (([RiskLevel]='blocked' OR [RiskLevel]='high' OR [RiskLevel]='medium' OR [RiskLevel]='low' OR [RiskLevel]='none'))
GO
ALTER TABLE [dbo].[BrowserActivityEvents] CHECK CONSTRAINT [CK_BrowserActivityEvents_RiskLevel]
GO
ALTER TABLE [dbo].[BrowserActivityEvents]  WITH CHECK ADD  CONSTRAINT [CK_BrowserActivityEvents_SecurityEventType] CHECK  (([SecurityEventType]='blocked_domain' OR [SecurityEventType]='malware' OR [SecurityEventType]='phishing' OR [SecurityEventType] IS NULL))
GO
ALTER TABLE [dbo].[BrowserActivityEvents] CHECK CONSTRAINT [CK_BrowserActivityEvents_SecurityEventType]
GO
ALTER TABLE [dbo].[BrowserActivitySettings]  WITH CHECK ADD  CONSTRAINT [CK_BrowserActivitySettings_Singleton] CHECK  (([Id]=(1)))
GO
ALTER TABLE [dbo].[BrowserActivitySettings] CHECK CONSTRAINT [CK_BrowserActivitySettings_Singleton]
GO
ALTER TABLE [dbo].[ChatMessages]  WITH CHECK ADD  CONSTRAINT [CK_ChatMessages_SenderType] CHECK  (([SenderType]='employee' OR [SenderType]='admin'))
GO
ALTER TABLE [dbo].[ChatMessages] CHECK CONSTRAINT [CK_ChatMessages_SenderType]
GO
ALTER TABLE [dbo].[CodeQualityGitHubConnections]  WITH CHECK ADD  CONSTRAINT [CK_CodeQualityGitHubConnections_AuthMethod] CHECK  (([AuthMethod]='GitHubApp' OR [AuthMethod]='OAuthApp' OR [AuthMethod]='PAT'))
GO
ALTER TABLE [dbo].[CodeQualityGitHubConnections] CHECK CONSTRAINT [CK_CodeQualityGitHubConnections_AuthMethod]
GO
ALTER TABLE [dbo].[CodeQualityIssues]  WITH CHECK ADD  CONSTRAINT [CK_CodeQualityIssues_Category] CHECK  (([Category]='CodingStandard' OR [Category]='UnusedFunction' OR [Category]='UnusedVariable' OR [Category]='DeadCode' OR [Category]='Duplication' OR [Category]='Complexity'))
GO
ALTER TABLE [dbo].[CodeQualityIssues] CHECK CONSTRAINT [CK_CodeQualityIssues_Category]
GO
ALTER TABLE [dbo].[CodeQualityIssues]  WITH CHECK ADD  CONSTRAINT [CK_CodeQualityIssues_Confidence] CHECK  (([ConfidenceLevel] IS NULL OR ([ConfidenceLevel]='High' OR [ConfidenceLevel]='Medium' OR [ConfidenceLevel]='Low')))
GO
ALTER TABLE [dbo].[CodeQualityIssues] CHECK CONSTRAINT [CK_CodeQualityIssues_Confidence]
GO
ALTER TABLE [dbo].[CodeQualityIssues]  WITH CHECK ADD  CONSTRAINT [CK_CodeQualityIssues_Severity] CHECK  (([Severity]='Critical' OR [Severity]='High' OR [Severity]='Medium' OR [Severity]='Low'))
GO
ALTER TABLE [dbo].[CodeQualityIssues] CHECK CONSTRAINT [CK_CodeQualityIssues_Severity]
GO
ALTER TABLE [dbo].[CodeQualityIssues]  WITH CHECK ADD  CONSTRAINT [CK_CodeQualityIssues_Status] CHECK  (([Status]='FalsePositive' OR [Status]='Ignored' OR [Status]='Resolved' OR [Status]='Confirmed' OR [Status]='Open'))
GO
ALTER TABLE [dbo].[CodeQualityIssues] CHECK CONSTRAINT [CK_CodeQualityIssues_Status]
GO
ALTER TABLE [dbo].[CodeQualityProjects]  WITH CHECK ADD  CONSTRAINT [CK_CodeQualityProjects_Status] CHECK  (([Status]='Inactive' OR [Status]='Active'))
GO
ALTER TABLE [dbo].[CodeQualityProjects] CHECK CONSTRAINT [CK_CodeQualityProjects_Status]
GO
ALTER TABLE [dbo].[CodeQualityRules]  WITH CHECK ADD  CONSTRAINT [CK_CodeQualityRules_Category] CHECK  (([Category]='CodingStandard' OR [Category]='UnusedFunction' OR [Category]='UnusedVariable' OR [Category]='DeadCode' OR [Category]='Duplication' OR [Category]='Complexity'))
GO
ALTER TABLE [dbo].[CodeQualityRules] CHECK CONSTRAINT [CK_CodeQualityRules_Category]
GO
ALTER TABLE [dbo].[CodeQualityRules]  WITH CHECK ADD  CONSTRAINT [CK_CodeQualityRules_Severity] CHECK  (([DefaultSeverity]='Critical' OR [DefaultSeverity]='High' OR [DefaultSeverity]='Medium' OR [DefaultSeverity]='Low'))
GO
ALTER TABLE [dbo].[CodeQualityRules] CHECK CONSTRAINT [CK_CodeQualityRules_Severity]
GO
ALTER TABLE [dbo].[CodeQualityScans]  WITH CHECK ADD  CONSTRAINT [CK_CodeQualityScans_ScanType] CHECK  (([ScanType]='Incremental' OR [ScanType]='Full'))
GO
ALTER TABLE [dbo].[CodeQualityScans] CHECK CONSTRAINT [CK_CodeQualityScans_ScanType]
GO
ALTER TABLE [dbo].[CodeQualityScans]  WITH CHECK ADD  CONSTRAINT [CK_CodeQualityScans_Status] CHECK  (([Status]='Cancelled' OR [Status]='Failed' OR [Status]='PartiallyCompleted' OR [Status]='Completed' OR [Status]='Running' OR [Status]='Queued' OR [Status]='Pending'))
GO
ALTER TABLE [dbo].[CodeQualityScans] CHECK CONSTRAINT [CK_CodeQualityScans_Status]
GO
ALTER TABLE [dbo].[ComplianceControlEvidence]  WITH CHECK ADD  CONSTRAINT [CK_ComplianceControlEvidence_Type] CHECK  (([Type]='file' OR [Type]='url'))
GO
ALTER TABLE [dbo].[ComplianceControlEvidence] CHECK CONSTRAINT [CK_ComplianceControlEvidence_Type]
GO
ALTER TABLE [dbo].[ComplianceControls]  WITH CHECK ADD  CONSTRAINT [CK_ComplianceControls_AutoCheckStatus] CHECK  (([AutoCheckStatus] IS NULL OR ([AutoCheckStatus]='unknown' OR [AutoCheckStatus]='fail' OR [AutoCheckStatus]='pass')))
GO
ALTER TABLE [dbo].[ComplianceControls] CHECK CONSTRAINT [CK_ComplianceControls_AutoCheckStatus]
GO
ALTER TABLE [dbo].[ComplianceControls]  WITH CHECK ADD  CONSTRAINT [CK_ComplianceControls_Status] CHECK  (([Status]='not_applicable' OR [Status]='implemented' OR [Status]='in_progress' OR [Status]='not_started'))
GO
ALTER TABLE [dbo].[ComplianceControls] CHECK CONSTRAINT [CK_ComplianceControls_Status]
GO
ALTER TABLE [dbo].[DbAnalyzerAiConfig]  WITH CHECK ADD  CONSTRAINT [CK_DbAnalyzerAiConfig_Mode] CHECK  (([Mode]='hybrid' OR [Mode]='ai' OR [Mode]='non_ai'))
GO
ALTER TABLE [dbo].[DbAnalyzerAiConfig] CHECK CONSTRAINT [CK_DbAnalyzerAiConfig_Mode]
GO
ALTER TABLE [dbo].[DbAnalyzerConnections]  WITH CHECK ADD  CONSTRAINT [CK_DbAnalyzerConnections_Engine] CHECK  (([Engine]='postgres' OR [Engine]='mysql' OR [Engine]='mssql'))
GO
ALTER TABLE [dbo].[DbAnalyzerConnections] CHECK CONSTRAINT [CK_DbAnalyzerConnections_Engine]
GO
ALTER TABLE [dbo].[DbAnalyzerConnections]  WITH CHECK ADD  CONSTRAINT [CK_DbAnalyzerConnections_Source] CHECK  (([Source]='upload' OR [Source]='live'))
GO
ALTER TABLE [dbo].[DbAnalyzerConnections] CHECK CONSTRAINT [CK_DbAnalyzerConnections_Source]
GO
ALTER TABLE [dbo].[DbAnalyzerFindings]  WITH CHECK ADD  CONSTRAINT [CK_DbAnalyzerFindings_Category] CHECK  (([Category]='sensitive-data' OR [Category]='security' OR [Category]='structure'))
GO
ALTER TABLE [dbo].[DbAnalyzerFindings] CHECK CONSTRAINT [CK_DbAnalyzerFindings_Category]
GO
ALTER TABLE [dbo].[DbAnalyzerFindings]  WITH CHECK ADD  CONSTRAINT [CK_DbAnalyzerFindings_Severity] CHECK  (([Severity]='info' OR [Severity]='low' OR [Severity]='medium' OR [Severity]='high' OR [Severity]='critical'))
GO
ALTER TABLE [dbo].[DbAnalyzerFindings] CHECK CONSTRAINT [CK_DbAnalyzerFindings_Severity]
GO
ALTER TABLE [dbo].[DbAnalyzerScans]  WITH CHECK ADD  CONSTRAINT [CK_DbAnalyzerScans_Status] CHECK  (([Status]='Failed' OR [Status]='Completed' OR [Status]='Running'))
GO
ALTER TABLE [dbo].[DbAnalyzerScans] CHECK CONSTRAINT [CK_DbAnalyzerScans_Status]
GO
ALTER TABLE [dbo].[DomainCategories]  WITH CHECK ADD  CONSTRAINT [CK_DomainCategories_RiskLevel] CHECK  (([RiskLevel]='high' OR [RiskLevel]='medium' OR [RiskLevel]='low' OR [RiskLevel]='none'))
GO
ALTER TABLE [dbo].[DomainCategories] CHECK CONSTRAINT [CK_DomainCategories_RiskLevel]
GO
ALTER TABLE [dbo].[DomainCategoryRules]  WITH CHECK ADD  CONSTRAINT [CK_DomainCategoryRules_MatchType] CHECK  (([MatchType]='contains' OR [MatchType]='suffix' OR [MatchType]='exact'))
GO
ALTER TABLE [dbo].[DomainCategoryRules] CHECK CONSTRAINT [CK_DomainCategoryRules_MatchType]
GO
ALTER TABLE [dbo].[DomainCategoryRules]  WITH CHECK ADD  CONSTRAINT [CK_DomainCategoryRules_Source] CHECK  (([Source]='threat_intel' OR [Source]='seed' OR [Source]='manual'))
GO
ALTER TABLE [dbo].[DomainCategoryRules] CHECK CONSTRAINT [CK_DomainCategoryRules_Source]
GO
ALTER TABLE [dbo].[ExcludedDomains]  WITH CHECK ADD  CONSTRAINT [CK_ExcludedDomains_Reason] CHECK  (([Reason]='other' OR [Reason]='legal' OR [Reason]='union' OR [Reason]='banking' OR [Reason]='medical' OR [Reason]='personal'))
GO
ALTER TABLE [dbo].[ExcludedDomains] CHECK CONSTRAINT [CK_ExcludedDomains_Reason]
GO
ALTER TABLE [dbo].[FileIntegrityEvents]  WITH CHECK ADD  CONSTRAINT [CK_FileIntegrityEvents_ChangeType] CHECK  (([ChangeType]='Created' OR [ChangeType]='Deleted' OR [ChangeType]='Modified' OR [ChangeType]='Baseline'))
GO
ALTER TABLE [dbo].[FileIntegrityEvents] CHECK CONSTRAINT [CK_FileIntegrityEvents_ChangeType]
GO
ALTER TABLE [dbo].[Incidents]  WITH CHECK ADD  CONSTRAINT [CK_Incidents_Severity] CHECK  (([Severity]='Critical' OR [Severity]='High' OR [Severity]='Medium' OR [Severity]='Low'))
GO
ALTER TABLE [dbo].[Incidents] CHECK CONSTRAINT [CK_Incidents_Severity]
GO
ALTER TABLE [dbo].[Incidents]  WITH CHECK ADD  CONSTRAINT [CK_Incidents_Status] CHECK  (([Status]='Closed' OR [Status]='Resolved' OR [Status]='Monitoring' OR [Status]='Identified' OR [Status]='Investigating' OR [Status]='Open'))
GO
ALTER TABLE [dbo].[Incidents] CHECK CONSTRAINT [CK_Incidents_Status]
GO
ALTER TABLE [dbo].[ItAssetNotifications]  WITH CHECK ADD  CONSTRAINT [CK_ItAssetNotifications_Severity] CHECK  (([Severity]='Low' OR [Severity]='Medium' OR [Severity]='High' OR [Severity]='Critical'))
GO
ALTER TABLE [dbo].[ItAssetNotifications] CHECK CONSTRAINT [CK_ItAssetNotifications_Severity]
GO
ALTER TABLE [dbo].[ItAssetSettings]  WITH CHECK ADD CHECK  (([Id]=(1)))
GO
ALTER TABLE [dbo].[ItAssetSettings]  WITH CHECK ADD  CONSTRAINT [CK_ItAssetSettings_NotificationFrequency] CHECK  (([NotificationFrequency]='Weekly' OR [NotificationFrequency]='Daily' OR [NotificationFrequency]='Immediate'))
GO
ALTER TABLE [dbo].[ItAssetSettings] CHECK CONSTRAINT [CK_ItAssetSettings_NotificationFrequency]
GO
ALTER TABLE [dbo].[LaravelSecurityIssues]  WITH CHECK ADD  CONSTRAINT [CK_LaravelSecurityIssues_Category] CHECK  (([Category]='Queue' OR [Category]='StorageLinks' OR [Category]='Sanitization' OR [Category]='Validation' OR [Category]='MassAssignment' OR [Category]='Csrf' OR [Category]='DotEnv' OR [Category]='AppKey' OR [Category]='AppDebug'))
GO
ALTER TABLE [dbo].[LaravelSecurityIssues] CHECK CONSTRAINT [CK_LaravelSecurityIssues_Category]
GO
ALTER TABLE [dbo].[LaravelSecurityIssues]  WITH CHECK ADD  CONSTRAINT [CK_LaravelSecurityIssues_Confidence] CHECK  (([ConfidenceLevel] IS NULL OR ([ConfidenceLevel]='High' OR [ConfidenceLevel]='Medium' OR [ConfidenceLevel]='Low')))
GO
ALTER TABLE [dbo].[LaravelSecurityIssues] CHECK CONSTRAINT [CK_LaravelSecurityIssues_Confidence]
GO
ALTER TABLE [dbo].[LaravelSecurityIssues]  WITH CHECK ADD  CONSTRAINT [CK_LaravelSecurityIssues_Severity] CHECK  (([Severity]='Critical' OR [Severity]='High' OR [Severity]='Medium' OR [Severity]='Low'))
GO
ALTER TABLE [dbo].[LaravelSecurityIssues] CHECK CONSTRAINT [CK_LaravelSecurityIssues_Severity]
GO
ALTER TABLE [dbo].[LaravelSecurityIssues]  WITH CHECK ADD  CONSTRAINT [CK_LaravelSecurityIssues_Status] CHECK  (([Status]='FalsePositive' OR [Status]='Ignored' OR [Status]='Resolved' OR [Status]='Confirmed' OR [Status]='Open'))
GO
ALTER TABLE [dbo].[LaravelSecurityIssues] CHECK CONSTRAINT [CK_LaravelSecurityIssues_Status]
GO
ALTER TABLE [dbo].[LaravelSecurityProjects]  WITH CHECK ADD  CONSTRAINT [CK_LaravelSecurityProjects_RepoProvider] CHECK  (([RepoProvider] IS NULL OR ([RepoProvider]='GitLab' OR [RepoProvider]='GitHub')))
GO
ALTER TABLE [dbo].[LaravelSecurityProjects] CHECK CONSTRAINT [CK_LaravelSecurityProjects_RepoProvider]
GO
ALTER TABLE [dbo].[LaravelSecurityProjects]  WITH CHECK ADD  CONSTRAINT [CK_LaravelSecurityProjects_Status] CHECK  (([Status]='Inactive' OR [Status]='Active'))
GO
ALTER TABLE [dbo].[LaravelSecurityProjects] CHECK CONSTRAINT [CK_LaravelSecurityProjects_Status]
GO
ALTER TABLE [dbo].[LaravelSecurityRules]  WITH CHECK ADD  CONSTRAINT [CK_LaravelSecurityRules_Category] CHECK  (([Category]='Queue' OR [Category]='StorageLinks' OR [Category]='Sanitization' OR [Category]='Validation' OR [Category]='MassAssignment' OR [Category]='Csrf' OR [Category]='DotEnv' OR [Category]='AppKey' OR [Category]='AppDebug'))
GO
ALTER TABLE [dbo].[LaravelSecurityRules] CHECK CONSTRAINT [CK_LaravelSecurityRules_Category]
GO
ALTER TABLE [dbo].[LaravelSecurityRules]  WITH CHECK ADD  CONSTRAINT [CK_LaravelSecurityRules_Severity] CHECK  (([DefaultSeverity]='Critical' OR [DefaultSeverity]='High' OR [DefaultSeverity]='Medium' OR [DefaultSeverity]='Low'))
GO
ALTER TABLE [dbo].[LaravelSecurityRules] CHECK CONSTRAINT [CK_LaravelSecurityRules_Severity]
GO
ALTER TABLE [dbo].[LaravelSecurityScans]  WITH CHECK ADD  CONSTRAINT [CK_LaravelSecurityScans_ScanType] CHECK  (([ScanType]='Incremental' OR [ScanType]='Full'))
GO
ALTER TABLE [dbo].[LaravelSecurityScans] CHECK CONSTRAINT [CK_LaravelSecurityScans_ScanType]
GO
ALTER TABLE [dbo].[LaravelSecurityScans]  WITH CHECK ADD  CONSTRAINT [CK_LaravelSecurityScans_Status] CHECK  (([Status]='Cancelled' OR [Status]='Failed' OR [Status]='PartiallyCompleted' OR [Status]='Completed' OR [Status]='Running' OR [Status]='Queued' OR [Status]='Pending'))
GO
ALTER TABLE [dbo].[LaravelSecurityScans] CHECK CONSTRAINT [CK_LaravelSecurityScans_Status]
GO
ALTER TABLE [dbo].[MailBlockingPolicies]  WITH CHECK ADD  CONSTRAINT [CK_MailBlockingPolicies_Action] CHECK  (([Action]='Allow' OR [Action]='Warn' OR [Action]='RemoveAttachment' OR [Action]='Quarantine' OR [Action]='Block' OR [Action]='Reject'))
GO
ALTER TABLE [dbo].[MailBlockingPolicies] CHECK CONSTRAINT [CK_MailBlockingPolicies_Action]
GO
ALTER TABLE [dbo].[MailBlockingPolicies]  WITH CHECK ADD  CONSTRAINT [CK_MailBlockingPolicies_Direction] CHECK  (([Direction]='Both' OR [Direction]='Outgoing' OR [Direction]='Incoming'))
GO
ALTER TABLE [dbo].[MailBlockingPolicies] CHECK CONSTRAINT [CK_MailBlockingPolicies_Direction]
GO
ALTER TABLE [dbo].[MailBlockingPolicies]  WITH CHECK ADD  CONSTRAINT [CK_MailBlockingPolicies_RulesJson_IsJson] CHECK  ((isjson([RulesJson])=(1)))
GO
ALTER TABLE [dbo].[MailBlockingPolicies] CHECK CONSTRAINT [CK_MailBlockingPolicies_RulesJson_IsJson]
GO
ALTER TABLE [dbo].[MailPolicyScopes]  WITH CHECK ADD  CONSTRAINT [CK_MailPolicyScopes_ScopeType] CHECK  (([ScopeType]='Provider' OR [ScopeType]='User' OR [ScopeType]='Group' OR [ScopeType]='Department' OR [ScopeType]='Domain' OR [ScopeType]='Global'))
GO
ALTER TABLE [dbo].[MailPolicyScopes] CHECK CONSTRAINT [CK_MailPolicyScopes_ScopeType]
GO
ALTER TABLE [dbo].[MailProviderConnections]  WITH CHECK ADD  CONSTRAINT [CK_MailProviderConnections_ProviderType] CHECK  (([ProviderType]='Generic' OR [ProviderType]='SmtpImap' OR [ProviderType]='ExchangeServer' OR [ProviderType]='GoogleWorkspace' OR [ProviderType]='M365'))
GO
ALTER TABLE [dbo].[MailProviderConnections] CHECK CONSTRAINT [CK_MailProviderConnections_ProviderType]
GO
ALTER TABLE [dbo].[MaintenanceLogs]  WITH CHECK ADD  CONSTRAINT [CK_MaintenanceLogs_ActivityType] CHECK  (([ActivityType]='Other' OR [ActivityType]='Troubleshooting' OR [ActivityType]='OperatingSystemUpgrade' OR [ActivityType]='NetworkConfiguration' OR [ActivityType]='SecurityHardening' OR [ActivityType]='AccountReview' OR [ActivityType]='PerformanceTuning' OR [ActivityType]='DiskCleanup' OR [ActivityType]='AntivirusScan' OR [ActivityType]='VulnerabilityScan' OR [ActivityType]='RestoreTest' OR [ActivityType]='BackupVerification' OR [ActivityType]='DatabaseBackup' OR [ActivityType]='ConfigurationChange' OR [ActivityType]='HardwareReplacement' OR [ActivityType]='CorrectiveMaintenance' OR [ActivityType]='PreventiveMaintenance'))
GO
ALTER TABLE [dbo].[MaintenanceLogs] CHECK CONSTRAINT [CK_MaintenanceLogs_ActivityType]
GO
ALTER TABLE [dbo].[MaintenanceLogs]  WITH CHECK ADD  CONSTRAINT [CK_MaintenanceLogs_DateOrder] CHECK  (([CompletedAt] IS NULL OR [StartAt] IS NULL OR [CompletedAt]>=[StartAt]))
GO
ALTER TABLE [dbo].[MaintenanceLogs] CHECK CONSTRAINT [CK_MaintenanceLogs_DateOrder]
GO
ALTER TABLE [dbo].[MaintenanceLogs]  WITH CHECK ADD  CONSTRAINT [CK_MaintenanceLogs_Priority] CHECK  (([Priority]='Low' OR [Priority]='Medium' OR [Priority]='High' OR [Priority]='Critical'))
GO
ALTER TABLE [dbo].[MaintenanceLogs] CHECK CONSTRAINT [CK_MaintenanceLogs_Priority]
GO
ALTER TABLE [dbo].[MaintenanceLogs]  WITH CHECK ADD  CONSTRAINT [CK_MaintenanceLogs_Status] CHECK  (([Status]='Deferred' OR [Status]='Cancelled' OR [Status]='Failed' OR [Status]='Completed' OR [Status]='InProgress' OR [Status]='Scheduled' OR [Status]='Planned'))
GO
ALTER TABLE [dbo].[MaintenanceLogs] CHECK CONSTRAINT [CK_MaintenanceLogs_Status]
GO
ALTER TABLE [dbo].[MaintenanceWindows]  WITH CHECK ADD  CONSTRAINT [CK_MaintenanceWindows_Recurrence] CHECK  (([RecurrenceRule] IS NULL OR ([RecurrenceRule]='Monthly' OR [RecurrenceRule]='Weekly' OR [RecurrenceRule]='Daily')))
GO
ALTER TABLE [dbo].[MaintenanceWindows] CHECK CONSTRAINT [CK_MaintenanceWindows_Recurrence]
GO
ALTER TABLE [dbo].[MalwareFindings]  WITH CHECK ADD  CONSTRAINT [CK_MalwareFindings_CheckType] CHECK  (([CheckType]='InjectedJs' OR [CheckType]='CryptoMiner' OR [CheckType]='WebShell' OR [CheckType]='Base64Malware' OR [CheckType]='HiddenIframe' OR [CheckType]='ObfuscatedPhp'))
GO
ALTER TABLE [dbo].[MalwareFindings] CHECK CONSTRAINT [CK_MalwareFindings_CheckType]
GO
ALTER TABLE [dbo].[MalwareFindings]  WITH CHECK ADD  CONSTRAINT [CK_MalwareFindings_Severity] CHECK  (([Severity]='Critical' OR [Severity]='High' OR [Severity]='Medium' OR [Severity]='Low'))
GO
ALTER TABLE [dbo].[MalwareFindings] CHECK CONSTRAINT [CK_MalwareFindings_Severity]
GO
ALTER TABLE [dbo].[MalwareFindings]  WITH CHECK ADD  CONSTRAINT [CK_MalwareFindings_Status] CHECK  (([Status]='Cleared' OR [Status]='Ignored' OR [Status]='Resolved' OR [Status]='Open'))
GO
ALTER TABLE [dbo].[MalwareFindings] CHECK CONSTRAINT [CK_MalwareFindings_Status]
GO
ALTER TABLE [dbo].[MalwareFindings]  WITH CHECK ADD  CONSTRAINT [CK_MalwareFindings_Target] CHECK  (([DeviceId] IS NOT NULL AND [WebsiteId] IS NULL OR [DeviceId] IS NULL AND [WebsiteId] IS NOT NULL))
GO
ALTER TABLE [dbo].[MalwareFindings] CHECK CONSTRAINT [CK_MalwareFindings_Target]
GO
ALTER TABLE [dbo].[MalwareScans]  WITH CHECK ADD  CONSTRAINT [CK_MalwareScans_Status] CHECK  (([Status]='Failed' OR [Status]='Completed' OR [Status]='Running'))
GO
ALTER TABLE [dbo].[MalwareScans] CHECK CONSTRAINT [CK_MalwareScans_Status]
GO
ALTER TABLE [dbo].[MalwareScans]  WITH CHECK ADD  CONSTRAINT [CK_MalwareScans_Target] CHECK  (([DeviceId] IS NOT NULL AND [WebsiteId] IS NULL OR [DeviceId] IS NULL AND [WebsiteId] IS NOT NULL))
GO
ALTER TABLE [dbo].[MalwareScans] CHECK CONSTRAINT [CK_MalwareScans_Target]
GO
ALTER TABLE [dbo].[MonitoringSettings]  WITH CHECK ADD  CONSTRAINT [CK_MonitoringSettings_Singleton] CHECK  (([Id]=(1)))
GO
ALTER TABLE [dbo].[MonitoringSettings] CHECK CONSTRAINT [CK_MonitoringSettings_Singleton]
GO
ALTER TABLE [dbo].[Monitors]  WITH CHECK ADD  CONSTRAINT [CK_Monitors_Status] CHECK  (([Status]='Pending' OR [Status]='Unknown' OR [Status]='Maintenance' OR [Status]='Paused' OR [Status]='Degraded' OR [Status]='Down' OR [Status]='Up'))
GO
ALTER TABLE [dbo].[Monitors] CHECK CONSTRAINT [CK_Monitors_Status]
GO
ALTER TABLE [dbo].[Monitors]  WITH CHECK ADD  CONSTRAINT [CK_Monitors_Type] CHECK  (([MonitorType]='Api' OR [MonitorType]='Website'))
GO
ALTER TABLE [dbo].[Monitors] CHECK CONSTRAINT [CK_Monitors_Type]
GO
ALTER TABLE [dbo].[NetworkDiagramDesigns]  WITH CHECK ADD  CONSTRAINT [CK_NetworkDiagramDesigns_DiagramJson_IsJson] CHECK  ((isjson([DiagramJson])=(1)))
GO
ALTER TABLE [dbo].[NetworkDiagramDesigns] CHECK CONSTRAINT [CK_NetworkDiagramDesigns_DiagramJson_IsJson]
GO
ALTER TABLE [dbo].[OffboardingActions]  WITH CHECK ADD  CONSTRAINT [CK_OffboardingActions_ActiveDirectoryStatus] CHECK  (([ActiveDirectoryStatus]='Failed' OR [ActiveDirectoryStatus]='Success' OR [ActiveDirectoryStatus]='Pending' OR [ActiveDirectoryStatus]='Skipped'))
GO
ALTER TABLE [dbo].[OffboardingActions] CHECK CONSTRAINT [CK_OffboardingActions_ActiveDirectoryStatus]
GO
ALTER TABLE [dbo].[OffboardingActions]  WITH CHECK ADD  CONSTRAINT [CK_OffboardingActions_AgentQaStatus] CHECK  (([AgentQaStatus]='Failed' OR [AgentQaStatus]='Success' OR [AgentQaStatus]='Pending' OR [AgentQaStatus]='Skipped'))
GO
ALTER TABLE [dbo].[OffboardingActions] CHECK CONSTRAINT [CK_OffboardingActions_AgentQaStatus]
GO
ALTER TABLE [dbo].[OffboardingActions]  WITH CHECK ADD  CONSTRAINT [CK_OffboardingActions_GitLabStatus] CHECK  (([GitLabStatus]='Failed' OR [GitLabStatus]='Success' OR [GitLabStatus]='Pending' OR [GitLabStatus]='Skipped'))
GO
ALTER TABLE [dbo].[OffboardingActions] CHECK CONSTRAINT [CK_OffboardingActions_GitLabStatus]
GO
ALTER TABLE [dbo].[OffboardingActions]  WITH CHECK ADD  CONSTRAINT [CK_OffboardingActions_GlesysStatus] CHECK  (([GlesysStatus]='ManualActionRequired' OR [GlesysStatus]='Failed' OR [GlesysStatus]='Success' OR [GlesysStatus]='Pending' OR [GlesysStatus]='Skipped'))
GO
ALTER TABLE [dbo].[OffboardingActions] CHECK CONSTRAINT [CK_OffboardingActions_GlesysStatus]
GO
ALTER TABLE [dbo].[OffboardingActions]  WITH CHECK ADD  CONSTRAINT [CK_OffboardingActions_LogMonitorStatus] CHECK  (([LogMonitorStatus]='Failed' OR [LogMonitorStatus]='Success' OR [LogMonitorStatus]='Pending' OR [LogMonitorStatus]='Skipped'))
GO
ALTER TABLE [dbo].[OffboardingActions] CHECK CONSTRAINT [CK_OffboardingActions_LogMonitorStatus]
GO
ALTER TABLE [dbo].[OffboardingActions]  WITH CHECK ADD  CONSTRAINT [CK_OffboardingActions_OverallStatus] CHECK  (([OverallStatus]='Failed' OR [OverallStatus]='PartiallyComplete' OR [OverallStatus]='Complete' OR [OverallStatus]='Pending'))
GO
ALTER TABLE [dbo].[OffboardingActions] CHECK CONSTRAINT [CK_OffboardingActions_OverallStatus]
GO
ALTER TABLE [dbo].[OffboardingActions]  WITH CHECK ADD  CONSTRAINT [CK_OffboardingActions_TeamworkStatus] CHECK  (([TeamworkStatus]='Failed' OR [TeamworkStatus]='Success' OR [TeamworkStatus]='Pending' OR [TeamworkStatus]='Skipped'))
GO
ALTER TABLE [dbo].[OffboardingActions] CHECK CONSTRAINT [CK_OffboardingActions_TeamworkStatus]
GO
ALTER TABLE [dbo].[PasswordChangeLogs]  WITH CHECK ADD  CONSTRAINT [CK_PasswordChangeLogs_AccountType] CHECK  (([AccountType]='Other' OR [AccountType]='EmailAccount' OR [AccountType]='BackupAccount' OR [AccountType]='NetworkDeviceAccount' OR [AccountType]='ApplicationAccount' OR [AccountType]='DatabaseAccount' OR [AccountType]='ServiceAccount' OR [AccountType]='DomainAdministrator' OR [AccountType]='LocalAdministrator'))
GO
ALTER TABLE [dbo].[PasswordChangeLogs] CHECK CONSTRAINT [CK_PasswordChangeLogs_AccountType]
GO
ALTER TABLE [dbo].[PasswordChangeLogs]  WITH CHECK ADD  CONSTRAINT [CK_PasswordChangeLogs_Status] CHECK  (([Status]='NotConfigured' OR [Status]='Overdue' OR [Status]='DueToday' OR [Status]='DueSoon' OR [Status]='Current'))
GO
ALTER TABLE [dbo].[PasswordChangeLogs] CHECK CONSTRAINT [CK_PasswordChangeLogs_Status]
GO
ALTER TABLE [dbo].[PasswordChangeLogs]  WITH CHECK ADD  CONSTRAINT [CK_PasswordChangeLogs_VerificationStatus] CHECK  (([VerificationStatus]='Failed' OR [VerificationStatus]='Verified' OR [VerificationStatus]='Pending' OR [VerificationStatus] IS NULL))
GO
ALTER TABLE [dbo].[PasswordChangeLogs] CHECK CONSTRAINT [CK_PasswordChangeLogs_VerificationStatus]
GO
ALTER TABLE [dbo].[PatchUpdateLogs]  WITH CHECK ADD  CONSTRAINT [CK_PatchUpdateLogs_DateOrder] CHECK  (([ActualInstallationDate] IS NULL OR [ScheduledInstallationDate] IS NULL OR [ActualInstallationDate]>=[ScheduledInstallationDate]))
GO
ALTER TABLE [dbo].[PatchUpdateLogs] CHECK CONSTRAINT [CK_PatchUpdateLogs_DateOrder]
GO
ALTER TABLE [dbo].[PatchUpdateLogs]  WITH CHECK ADD  CONSTRAINT [CK_PatchUpdateLogs_FailureReasonRequired] CHECK  (([InstallationStatus]<>'Failed' OR [FailureReason] IS NOT NULL))
GO
ALTER TABLE [dbo].[PatchUpdateLogs] CHECK CONSTRAINT [CK_PatchUpdateLogs_FailureReasonRequired]
GO
ALTER TABLE [dbo].[PatchUpdateLogs]  WITH CHECK ADD  CONSTRAINT [CK_PatchUpdateLogs_InstallationStatus] CHECK  (([InstallationStatus]='NotApplicable' OR [InstallationStatus]='Deferred' OR [InstallationStatus]='RolledBack' OR [InstallationStatus]='Failed' OR [InstallationStatus]='Installed' OR [InstallationStatus]='InProgress' OR [InstallationStatus]='Scheduled' OR [InstallationStatus]='Planned'))
GO
ALTER TABLE [dbo].[PatchUpdateLogs] CHECK CONSTRAINT [CK_PatchUpdateLogs_InstallationStatus]
GO
ALTER TABLE [dbo].[PatchUpdateLogs]  WITH CHECK ADD  CONSTRAINT [CK_PatchUpdateLogs_RollbackDetailsRequired] CHECK  (([RollbackPerformed]=(0) OR [RollbackDetails] IS NOT NULL))
GO
ALTER TABLE [dbo].[PatchUpdateLogs] CHECK CONSTRAINT [CK_PatchUpdateLogs_RollbackDetailsRequired]
GO
ALTER TABLE [dbo].[PatchUpdateLogs]  WITH CHECK ADD  CONSTRAINT [CK_PatchUpdateLogs_Severity] CHECK  (([Severity]='Informational' OR [Severity]='Low' OR [Severity]='Medium' OR [Severity]='High' OR [Severity]='Critical'))
GO
ALTER TABLE [dbo].[PatchUpdateLogs] CHECK CONSTRAINT [CK_PatchUpdateLogs_Severity]
GO
ALTER TABLE [dbo].[PatchUpdateLogs]  WITH CHECK ADD  CONSTRAINT [CK_PatchUpdateLogs_UpdateType] CHECK  (([UpdateType]='Other' OR [UpdateType]='EmergencyPatch' OR [UpdateType]='Hotfix' OR [UpdateType]='AntivirusDefinition' OR [UpdateType]='ApplicationUpdate' OR [UpdateType]='DriverUpdate' OR [UpdateType]='FirmwareUpdate' OR [UpdateType]='SecurityPatch' OR [UpdateType]='OperatingSystemUpdate'))
GO
ALTER TABLE [dbo].[PatchUpdateLogs] CHECK CONSTRAINT [CK_PatchUpdateLogs_UpdateType]
GO
ALTER TABLE [dbo].[PatchUpdateLogs]  WITH CHECK ADD  CONSTRAINT [CK_PatchUpdateLogs_ValidationStatus] CHECK  (([ValidationStatus]='NotRequired' OR [ValidationStatus]='Failed' OR [ValidationStatus]='Successful' OR [ValidationStatus]='Pending'))
GO
ALTER TABLE [dbo].[PatchUpdateLogs] CHECK CONSTRAINT [CK_PatchUpdateLogs_ValidationStatus]
GO
ALTER TABLE [dbo].[PendingPowerActionRequests]  WITH CHECK ADD  CONSTRAINT [CK_PendingPowerActionRequests_ActionType] CHECK  (([ActionType]='shutdown' OR [ActionType]='reboot' OR [ActionType]='logoff'))
GO
ALTER TABLE [dbo].[PendingPowerActionRequests] CHECK CONSTRAINT [CK_PendingPowerActionRequests_ActionType]
GO
ALTER TABLE [dbo].[RemoteAccessSettings]  WITH CHECK ADD  CONSTRAINT [CK_RemoteAccessSettings_Singleton] CHECK  (([Id]=(1)))
GO
ALTER TABLE [dbo].[RemoteAccessSettings] CHECK CONSTRAINT [CK_RemoteAccessSettings_Singleton]
GO
ALTER TABLE [dbo].[RemoteApprovalRequests]  WITH CHECK ADD  CONSTRAINT [CK_RemoteApprovalRequests_Status] CHECK  (([Status]='Rejected' OR [Status]='Approved' OR [Status]='Pending'))
GO
ALTER TABLE [dbo].[RemoteApprovalRequests] CHECK CONSTRAINT [CK_RemoteApprovalRequests_Status]
GO
ALTER TABLE [dbo].[RemoteAuditLog]  WITH CHECK ADD  CONSTRAINT [CK_RemoteAuditLog_Result] CHECK  (([Result]='Failure' OR [Result]='Success'))
GO
ALTER TABLE [dbo].[RemoteAuditLog] CHECK CONSTRAINT [CK_RemoteAuditLog_Result]
GO
ALTER TABLE [dbo].[RemoteConnectionChecks]  WITH CHECK ADD  CONSTRAINT [CK_RemoteConnectionChecks_Status] CHECK  (([Status]='Degraded' OR [Status]='Offline' OR [Status]='Online'))
GO
ALTER TABLE [dbo].[RemoteConnectionChecks] CHECK CONSTRAINT [CK_RemoteConnectionChecks_Status]
GO
ALTER TABLE [dbo].[RemoteConnections]  WITH CHECK ADD  CONSTRAINT [CK_RemoteConnections_Availability] CHECK  (([AvailabilityStatus]='Unknown' OR [AvailabilityStatus]='Degraded' OR [AvailabilityStatus]='Offline' OR [AvailabilityStatus]='Online'))
GO
ALTER TABLE [dbo].[RemoteConnections] CHECK CONSTRAINT [CK_RemoteConnections_Availability]
GO
ALTER TABLE [dbo].[RemoteConnections]  WITH CHECK ADD  CONSTRAINT [CK_RemoteConnections_Environment] CHECK  (([Environment]='Custom' OR [Environment]='Local' OR [Environment]='DisasterRecovery' OR [Environment]='Testing' OR [Environment]='Development' OR [Environment]='Staging' OR [Environment]='Production'))
GO
ALTER TABLE [dbo].[RemoteConnections] CHECK CONSTRAINT [CK_RemoteConnections_Environment]
GO
ALTER TABLE [dbo].[RemoteConnections]  WITH CHECK ADD  CONSTRAINT [CK_RemoteConnections_Protocol] CHECK  (([Protocol]='SerialConsole' OR [Protocol]='WebAdmin' OR [Protocol]='WinRM' OR [Protocol]='Telnet' OR [Protocol]='VNC' OR [Protocol]='FTPS' OR [Protocol]='FTP' OR [Protocol]='SCP' OR [Protocol]='SFTP' OR [Protocol]='RDP' OR [Protocol]='SSH'))
GO
ALTER TABLE [dbo].[RemoteConnections] CHECK CONSTRAINT [CK_RemoteConnections_Protocol]
GO
ALTER TABLE [dbo].[RemoteCredentials]  WITH CHECK ADD  CONSTRAINT [CK_RemoteCredentials_Type] CHECK  (([CredentialType]='Custom' OR [CredentialType]='Database' OR [CredentialType]='Certificate' OR [CredentialType]='ApiToken' OR [CredentialType]='Ftp' OR [CredentialType]='Rdp' OR [CredentialType]='SshKeyPassphrase' OR [CredentialType]='WindowsDomain' OR [CredentialType]='UsernamePassword'))
GO
ALTER TABLE [dbo].[RemoteCredentials] CHECK CONSTRAINT [CK_RemoteCredentials_Type]
GO
ALTER TABLE [dbo].[RemoteFileTransfers]  WITH CHECK ADD  CONSTRAINT [CK_RemoteFileTransfers_Direction] CHECK  (([Direction]='Download' OR [Direction]='Upload'))
GO
ALTER TABLE [dbo].[RemoteFileTransfers] CHECK CONSTRAINT [CK_RemoteFileTransfers_Direction]
GO
ALTER TABLE [dbo].[RemoteFileTransfers]  WITH CHECK ADD  CONSTRAINT [CK_RemoteFileTransfers_Status] CHECK  (([Status]='InProgress' OR [Status]='Failed' OR [Status]='Completed'))
GO
ALTER TABLE [dbo].[RemoteFileTransfers] CHECK CONSTRAINT [CK_RemoteFileTransfers_Status]
GO
ALTER TABLE [dbo].[RemoteInventoryDevices]  WITH CHECK ADD  CONSTRAINT [CK_RemoteInventoryDevices_Availability] CHECK  (([AvailabilityStatus]='Unknown' OR [AvailabilityStatus]='Degraded' OR [AvailabilityStatus]='Offline' OR [AvailabilityStatus]='Online'))
GO
ALTER TABLE [dbo].[RemoteInventoryDevices] CHECK CONSTRAINT [CK_RemoteInventoryDevices_Availability]
GO
ALTER TABLE [dbo].[RemoteInventoryDevices]  WITH CHECK ADD  CONSTRAINT [CK_RemoteInventoryDevices_DeviceTypeCategory] CHECK  (([DeviceTypeCategory]='Cloud' OR [DeviceTypeCategory]='Container' OR [DeviceTypeCategory]='VirtualMachine' OR [DeviceTypeCategory]='NetworkDevice' OR [DeviceTypeCategory]='Pc' OR [DeviceTypeCategory]='LinuxServer' OR [DeviceTypeCategory]='WindowsServer' OR [DeviceTypeCategory] IS NULL))
GO
ALTER TABLE [dbo].[RemoteInventoryDevices] CHECK CONSTRAINT [CK_RemoteInventoryDevices_DeviceTypeCategory]
GO
ALTER TABLE [dbo].[RemotePortForwards]  WITH CHECK ADD  CONSTRAINT [CK_RemotePortForwards_ForwardType] CHECK  (([ForwardType]='Dynamic' OR [ForwardType]='Remote' OR [ForwardType]='Local'))
GO
ALTER TABLE [dbo].[RemotePortForwards] CHECK CONSTRAINT [CK_RemotePortForwards_ForwardType]
GO
ALTER TABLE [dbo].[RemotePortForwards]  WITH CHECK ADD  CONSTRAINT [CK_RemotePortForwards_Status] CHECK  (([Status]='Failed' OR [Status]='Stopped' OR [Status]='Active'))
GO
ALTER TABLE [dbo].[RemotePortForwards] CHECK CONSTRAINT [CK_RemotePortForwards_Status]
GO
ALTER TABLE [dbo].[RemoteProtocolDiagnostics]  WITH CHECK ADD  CONSTRAINT [CK_RemoteProtocolDiagnostics_Status] CHECK  (([Status]='NotSupported' OR [Status]='Unreachable' OR [Status]='Reachable'))
GO
ALTER TABLE [dbo].[RemoteProtocolDiagnostics] CHECK CONSTRAINT [CK_RemoteProtocolDiagnostics_Status]
GO
ALTER TABLE [dbo].[RemoteScriptExecutions]  WITH CHECK ADD  CONSTRAINT [CK_RemoteScriptExecutions_Status] CHECK  (([Status]='Failed' OR [Status]='Completed' OR [Status]='Running'))
GO
ALTER TABLE [dbo].[RemoteScriptExecutions] CHECK CONSTRAINT [CK_RemoteScriptExecutions_Status]
GO
ALTER TABLE [dbo].[RemoteScripts]  WITH CHECK ADD  CONSTRAINT [CK_RemoteScripts_ScriptType] CHECK  (([ScriptType]='Command' OR [ScriptType]='Batch' OR [ScriptType]='Python' OR [ScriptType]='PowerShell' OR [ScriptType]='Shell'))
GO
ALTER TABLE [dbo].[RemoteScripts] CHECK CONSTRAINT [CK_RemoteScripts_ScriptType]
GO
ALTER TABLE [dbo].[RemoteScripts]  WITH CHECK ADD  CONSTRAINT [CK_RemoteScripts_TargetOsFamily] CHECK  (([TargetOsFamily]='Any' OR [TargetOsFamily]='Windows' OR [TargetOsFamily]='Linux' OR [TargetOsFamily] IS NULL))
GO
ALTER TABLE [dbo].[RemoteScripts] CHECK CONSTRAINT [CK_RemoteScripts_TargetOsFamily]
GO
ALTER TABLE [dbo].[RemoteSessionLogs]  WITH CHECK ADD  CONSTRAINT [CK_RemoteSessionLogs_Direction] CHECK  (([Direction]='Output' OR [Direction]='Input'))
GO
ALTER TABLE [dbo].[RemoteSessionLogs] CHECK CONSTRAINT [CK_RemoteSessionLogs_Direction]
GO
ALTER TABLE [dbo].[RemoteSessions]  WITH CHECK ADD  CONSTRAINT [CK_RemoteSessions_RecordingStatus] CHECK  (([RecordingStatus]='Recorded' OR [RecordingStatus]='Recording' OR [RecordingStatus]='NotRecorded'))
GO
ALTER TABLE [dbo].[RemoteSessions] CHECK CONSTRAINT [CK_RemoteSessions_RecordingStatus]
GO
ALTER TABLE [dbo].[RemoteSessions]  WITH CHECK ADD  CONSTRAINT [CK_RemoteSessions_SessionType] CHECK  (([SessionType]='Rdp' OR [SessionType]='Vnc' OR [SessionType]='Sftp' OR [SessionType]='Terminal'))
GO
ALTER TABLE [dbo].[RemoteSessions] CHECK CONSTRAINT [CK_RemoteSessions_SessionType]
GO
ALTER TABLE [dbo].[RemoteSessions]  WITH CHECK ADD  CONSTRAINT [CK_RemoteSessions_Status] CHECK  (([Status]='Terminated' OR [Status]='Failed' OR [Status]='Ended' OR [Status]='Active'))
GO
ALTER TABLE [dbo].[RemoteSessions] CHECK CONSTRAINT [CK_RemoteSessions_Status]
GO
ALTER TABLE [dbo].[RemoteSSHKeys]  WITH CHECK ADD  CONSTRAINT [CK_RemoteSSHKeys_Type] CHECK  (([KeyType]='Rsa' OR [KeyType]='Ed25519'))
GO
ALTER TABLE [dbo].[RemoteSSHKeys] CHECK CONSTRAINT [CK_RemoteSSHKeys_Type]
GO
ALTER TABLE [dbo].[RepoConnections]  WITH CHECK ADD  CONSTRAINT [CK_RepoConnections_AuthMethod] CHECK  (([AuthMethod]='GitHubApp' OR [AuthMethod]='OAuthApp' OR [AuthMethod]='PAT'))
GO
ALTER TABLE [dbo].[RepoConnections] CHECK CONSTRAINT [CK_RepoConnections_AuthMethod]
GO
ALTER TABLE [dbo].[RepoConnections]  WITH CHECK ADD  CONSTRAINT [CK_RepoConnections_Provider] CHECK  (([Provider]='GitLab' OR [Provider]='GitHub'))
GO
ALTER TABLE [dbo].[RepoConnections] CHECK CONSTRAINT [CK_RepoConnections_Provider]
GO
ALTER TABLE [dbo].[ScheduledReports]  WITH CHECK ADD  CONSTRAINT [CK_ScheduledReports_Format] CHECK  (([Format]='Excel' OR [Format]='Pdf' OR [Format]='Csv' OR [Format]='Email'))
GO
ALTER TABLE [dbo].[ScheduledReports] CHECK CONSTRAINT [CK_ScheduledReports_Format]
GO
ALTER TABLE [dbo].[ScheduledReports]  WITH CHECK ADD  CONSTRAINT [CK_ScheduledReports_Frequency] CHECK  (([Frequency]='Monthly' OR [Frequency]='Weekly' OR [Frequency]='Daily'))
GO
ALTER TABLE [dbo].[ScheduledReports] CHECK CONSTRAINT [CK_ScheduledReports_Frequency]
GO
ALTER TABLE [dbo].[ScheduledReports]  WITH CHECK ADD  CONSTRAINT [CK_ScheduledReports_Scope] CHECK  (([MonitorScope]='Selected' OR [MonitorScope]='All'))
GO
ALTER TABLE [dbo].[ScheduledReports] CHECK CONSTRAINT [CK_ScheduledReports_Scope]
GO
ALTER TABLE [dbo].[SecurityAlerts]  WITH CHECK ADD  CONSTRAINT [CK_SecurityAlerts_Severity] CHECK  (([Severity]='critical' OR [Severity]='high' OR [Severity]='medium' OR [Severity]='low' OR [Severity]='informational'))
GO
ALTER TABLE [dbo].[SecurityAlerts] CHECK CONSTRAINT [CK_SecurityAlerts_Severity]
GO
ALTER TABLE [dbo].[SecurityAlerts]  WITH CHECK ADD  CONSTRAINT [CK_SecurityAlerts_Status] CHECK  (([Status]='Suppressed' OR [Status]='Resolved' OR [Status]='FalsePositive' OR [Status]='Confirmed' OR [Status]='Investigating' OR [Status]='New'))
GO
ALTER TABLE [dbo].[SecurityAlerts] CHECK CONSTRAINT [CK_SecurityAlerts_Status]
GO
ALTER TABLE [dbo].[SecurityDetectionRules]  WITH CHECK ADD  CONSTRAINT [CK_SecurityDetectionRules_Confidence] CHECK  (([Confidence]>=(0) AND [Confidence]<=(100)))
GO
ALTER TABLE [dbo].[SecurityDetectionRules] CHECK CONSTRAINT [CK_SecurityDetectionRules_Confidence]
GO
ALTER TABLE [dbo].[SecurityDetectionRules]  WITH CHECK ADD  CONSTRAINT [CK_SecurityDetectionRules_Severity] CHECK  (([Severity]='critical' OR [Severity]='high' OR [Severity]='medium' OR [Severity]='low' OR [Severity]='informational'))
GO
ALTER TABLE [dbo].[SecurityDetectionRules] CHECK CONSTRAINT [CK_SecurityDetectionRules_Severity]
GO
ALTER TABLE [dbo].[SecurityFileIntegrityEvents]  WITH CHECK ADD  CONSTRAINT [CK_SecurityFileIntegrityEvents_ChangeType] CHECK  (([ChangeType]='Deleted' OR [ChangeType]='Modified' OR [ChangeType]='Created'))
GO
ALTER TABLE [dbo].[SecurityFileIntegrityEvents] CHECK CONSTRAINT [CK_SecurityFileIntegrityEvents_ChangeType]
GO
ALTER TABLE [dbo].[SecurityIpBlocklist]  WITH CHECK ADD  CONSTRAINT [CK_SecurityIpBlocklist_Source] CHECK  (([Source]='Auto' OR [Source]='Rule' OR [Source]='Manual'))
GO
ALTER TABLE [dbo].[SecurityIpBlocklist] CHECK CONSTRAINT [CK_SecurityIpBlocklist_Source]
GO
ALTER TABLE [dbo].[SecurityProtectedApplications]  WITH CHECK ADD  CONSTRAINT [CK_SecurityProtectedApplications_AppType] CHECK  (([AppType]='Other' OR [AppType]='Server' OR [AppType]='Router' OR [AppType]='Firewall' OR [AppType]='WebApp'))
GO
ALTER TABLE [dbo].[SecurityProtectedApplications] CHECK CONSTRAINT [CK_SecurityProtectedApplications_AppType]
GO
ALTER TABLE [dbo].[SecurityResponseActions]  WITH CHECK ADD  CONSTRAINT [CK_SecurityResponseActions_Status] CHECK  (([Status]='RolledBack' OR [Status]='Failed' OR [Status]='Executed' OR [Status]='Simulated' OR [Status]='Pending'))
GO
ALTER TABLE [dbo].[SecurityResponseActions] CHECK CONSTRAINT [CK_SecurityResponseActions_Status]
GO
ALTER TABLE [dbo].[SecurityRuleExclusions]  WITH CHECK ADD  CONSTRAINT [CK_SecurityRuleExclusions_Type] CHECK  (([ExclusionType]='UserAgent' OR [ExclusionType]='Path' OR [ExclusionType]='IP'))
GO
ALTER TABLE [dbo].[SecurityRuleExclusions] CHECK CONSTRAINT [CK_SecurityRuleExclusions_Type]
GO
ALTER TABLE [dbo].[SecurityUserRoles]  WITH CHECK ADD  CONSTRAINT [CK_SecurityUserRoles_Role] CHECK  (([Role]='viewer' OR [Role]='security_analyst' OR [Role]='security_admin'))
GO
ALTER TABLE [dbo].[SecurityUserRoles] CHECK CONSTRAINT [CK_SecurityUserRoles_Role]
GO
ALTER TABLE [dbo].[SlaConfigurations]  WITH CHECK ADD  CONSTRAINT [CK_SlaConfigurations_Window] CHECK  (([EvaluationWindow]='Monthly' OR [EvaluationWindow]='Weekly' OR [EvaluationWindow]='Daily'))
GO
ALTER TABLE [dbo].[SlaConfigurations] CHECK CONSTRAINT [CK_SlaConfigurations_Window]
GO
ALTER TABLE [dbo].[SoftwareInventory]  WITH CHECK ADD  CONSTRAINT [CK_SoftwareInventory_ApprovalStatus] CHECK  (([ApprovalStatus]='NotRequired' OR [ApprovalStatus]='Rejected' OR [ApprovalStatus]='PendingApproval' OR [ApprovalStatus]='Approved'))
GO
ALTER TABLE [dbo].[SoftwareInventory] CHECK CONSTRAINT [CK_SoftwareInventory_ApprovalStatus]
GO
ALTER TABLE [dbo].[SoftwareInventory]  WITH CHECK ADD  CONSTRAINT [CK_SoftwareInventory_SoftwareStatus] CHECK  (([SoftwareStatus]='Removed' OR [SoftwareStatus]='Unapproved' OR [SoftwareStatus]='Approved' OR [SoftwareStatus]='Unlicensed' OR [SoftwareStatus]='Unsupported' OR [SoftwareStatus]='UpdateRequired' OR [SoftwareStatus]='Installed'))
GO
ALTER TABLE [dbo].[SoftwareInventory] CHECK CONSTRAINT [CK_SoftwareInventory_SoftwareStatus]
GO
ALTER TABLE [dbo].[SqlServerInstances]  WITH CHECK ADD  CONSTRAINT [CK_SqlServerInstances_AuthType] CHECK  (([AuthType]='windows' OR [AuthType]='sql'))
GO
ALTER TABLE [dbo].[SqlServerInstances] CHECK CONSTRAINT [CK_SqlServerInstances_AuthType]
GO
ALTER TABLE [dbo].[SqlServerInstances]  WITH CHECK ADD  CONSTRAINT [CK_SqlServerInstances_Engine] CHECK  (([Engine]='postgres' OR [Engine]='mysql' OR [Engine]='mssql'))
GO
ALTER TABLE [dbo].[SqlServerInstances] CHECK CONSTRAINT [CK_SqlServerInstances_Engine]
GO
ALTER TABLE [dbo].[SqlServerSlowQueries]  WITH CHECK ADD  CONSTRAINT [CK_SqlServerSlowQueries_RankBy] CHECK  (([RankBy]='reads' OR [RankBy]='memory' OR [RankBy]='cpu' OR [RankBy]='duration'))
GO
ALTER TABLE [dbo].[SqlServerSlowQueries] CHECK CONSTRAINT [CK_SqlServerSlowQueries_RankBy]
GO
ALTER TABLE [dbo].[Staff]  WITH CHECK ADD  CONSTRAINT [CK_Staff_EmploymentStatus] CHECK  (([EmploymentStatus]='On Leave' OR [EmploymentStatus]='Transferred' OR [EmploymentStatus]='Redundancy / Layoff' OR [EmploymentStatus]='Job Abandonment' OR [EmploymentStatus]='Probation Not Confirmed' OR [EmploymentStatus]='Mutual Separation' OR [EmploymentStatus]='Retired' OR [EmploymentStatus]='Contract Expired' OR [EmploymentStatus]='Contract Completed' OR [EmploymentStatus]='Terminated' OR [EmploymentStatus]='Resigned' OR [EmploymentStatus]='Active'))
GO
ALTER TABLE [dbo].[Staff] CHECK CONSTRAINT [CK_Staff_EmploymentStatus]
GO
ALTER TABLE [dbo].[ThreatScans]  WITH CHECK ADD  CONSTRAINT [CK_ThreatScans_Kind] CHECK  (([Kind]='Domain' OR [Kind]='Ip' OR [Kind]='Hash' OR [Kind]='Url' OR [Kind]='File'))
GO
ALTER TABLE [dbo].[ThreatScans] CHECK CONSTRAINT [CK_ThreatScans_Kind]
GO
ALTER TABLE [dbo].[ThreatScans]  WITH CHECK ADD  CONSTRAINT [CK_ThreatScans_Status] CHECK  (([Status]='NotFound' OR [Status]='Failed' OR [Status]='Completed' OR [Status]='Running' OR [Status]='Pending'))
GO
ALTER TABLE [dbo].[ThreatScans] CHECK CONSTRAINT [CK_ThreatScans_Status]
GO
ALTER TABLE [dbo].[UsbDevicePolicies]  WITH CHECK ADD  CONSTRAINT [CK_UsbDevicePolicies_Action] CHECK  (([Action]='Allow' OR [Action]='Block'))
GO
ALTER TABLE [dbo].[UsbDevicePolicies] CHECK CONSTRAINT [CK_UsbDevicePolicies_Action]
GO
ALTER TABLE [dbo].[VulnerabilityFindings]  WITH CHECK ADD  CONSTRAINT [CK_VulnerabilityFindings_Severity] CHECK  (([Severity]='Informational' OR [Severity]='Low' OR [Severity]='Medium' OR [Severity]='High' OR [Severity]='Critical'))
GO
ALTER TABLE [dbo].[VulnerabilityFindings] CHECK CONSTRAINT [CK_VulnerabilityFindings_Severity]
GO
ALTER TABLE [dbo].[VulnerabilityFindings]  WITH CHECK ADD  CONSTRAINT [CK_VulnerabilityFindings_Status] CHECK  (([Status]='Accepted' OR [Status]='Resolved' OR [Status]='FalsePositive' OR [Status]='Confirmed' OR [Status]='Open'))
GO
ALTER TABLE [dbo].[VulnerabilityFindings] CHECK CONSTRAINT [CK_VulnerabilityFindings_Status]
GO
ALTER TABLE [dbo].[VulnerabilityScans]  WITH CHECK ADD  CONSTRAINT [CK_VulnerabilityScans_AdHocAuthorized] CHECK  (([IsAdHocTarget]=(0) OR [AuthorizedByUserId] IS NOT NULL))
GO
ALTER TABLE [dbo].[VulnerabilityScans] CHECK CONSTRAINT [CK_VulnerabilityScans_AdHocAuthorized]
GO
ALTER TABLE [dbo].[VulnerabilityScans]  WITH CHECK ADD  CONSTRAINT [CK_VulnerabilityScans_Status] CHECK  (([Status]='Failed' OR [Status]='Completed' OR [Status]='Running' OR [Status]='Pending'))
GO
ALTER TABLE [dbo].[VulnerabilityScans] CHECK CONSTRAINT [CK_VulnerabilityScans_Status]
GO
ALTER TABLE [dbo].[WacCriticalAllowlist]  WITH CHECK ADD  CONSTRAINT [CK_WacCriticalAllowlist_HasTarget] CHECK  (([Domain] IS NOT NULL OR [IpAddress] IS NOT NULL))
GO
ALTER TABLE [dbo].[WacCriticalAllowlist] CHECK CONSTRAINT [CK_WacCriticalAllowlist_HasTarget]
GO
ALTER TABLE [dbo].[WacCriticalAllowlist]  WITH CHECK ADD  CONSTRAINT [CK_WacCriticalAllowlist_MatchType] CHECK  (([MatchType]='suffix' OR [MatchType]='exact'))
GO
ALTER TABLE [dbo].[WacCriticalAllowlist] CHECK CONSTRAINT [CK_WacCriticalAllowlist_MatchType]
GO
ALTER TABLE [dbo].[WacSyncStatus]  WITH CHECK ADD  CONSTRAINT [CK_WacSyncStatus_PolicyType] CHECK  (([PolicyType]='CriticalAllowlist' OR [PolicyType]='WebsiteRule'))
GO
ALTER TABLE [dbo].[WacSyncStatus] CHECK CONSTRAINT [CK_WacSyncStatus_PolicyType]
GO
ALTER TABLE [dbo].[WacSyncStatus]  WITH CHECK ADD  CONSTRAINT [CK_WacSyncStatus_Status] CHECK  (([Status]='Failed' OR [Status]='Synced' OR [Status]='Pending' OR [Status]='NotConnected'))
GO
ALTER TABLE [dbo].[WacSyncStatus] CHECK CONSTRAINT [CK_WacSyncStatus_Status]
GO
ALTER TABLE [dbo].[WacWebsiteRules]  WITH CHECK ADD  CONSTRAINT [CK_WacWebsiteRules_Action] CHECK  (([Action]='Block' OR [Action]='Allow'))
GO
ALTER TABLE [dbo].[WacWebsiteRules] CHECK CONSTRAINT [CK_WacWebsiteRules_Action]
GO
ALTER TABLE [dbo].[WacWebsiteRules]  WITH CHECK ADD  CONSTRAINT [CK_WacWebsiteRules_MatchType] CHECK  (([MatchType]='suffix' OR [MatchType]='exact'))
GO
ALTER TABLE [dbo].[WacWebsiteRules] CHECK CONSTRAINT [CK_WacWebsiteRules_MatchType]
GO
ALTER TABLE [dbo].[WacWebsiteRules]  WITH CHECK ADD  CONSTRAINT [CK_WacWebsiteRules_Priority] CHECK  (([Priority]='High' OR [Priority]='Normal' OR [Priority]='Low'))
GO
ALTER TABLE [dbo].[WacWebsiteRules] CHECK CONSTRAINT [CK_WacWebsiteRules_Priority]
GO
ALTER TABLE [dbo].[WacWebsiteRules]  WITH CHECK ADD  CONSTRAINT [CK_WacWebsiteRules_ScopeType] CHECK  (([ScopeType]='Global' OR [ScopeType]='Group' OR [ScopeType]='Staff'))
GO
ALTER TABLE [dbo].[WacWebsiteRules] CHECK CONSTRAINT [CK_WacWebsiteRules_ScopeType]
GO
ALTER TABLE [dbo].[WacWebsiteRules]  WITH CHECK ADD  CONSTRAINT [CK_WacWebsiteRules_Status] CHECK  (([Status]='Disabled' OR [Status]='Enabled'))
GO
ALTER TABLE [dbo].[WacWebsiteRules] CHECK CONSTRAINT [CK_WacWebsiteRules_Status]
GO
ALTER TABLE [dbo].[WafApplications]  WITH CHECK ADD  CONSTRAINT [CK_WafApplications_Status] CHECK  (([Status]='Disabled' OR [Status]='Enabled'))
GO
ALTER TABLE [dbo].[WafApplications] CHECK CONSTRAINT [CK_WafApplications_Status]
GO
ALTER TABLE [dbo].[WafApplications]  WITH CHECK ADD  CONSTRAINT [CK_WafApplications_WafMode] CHECK  (([WafMode]='Blocking' OR [WafMode]='Monitoring' OR [WafMode]='Disabled'))
GO
ALTER TABLE [dbo].[WafApplications] CHECK CONSTRAINT [CK_WafApplications_WafMode]
GO
ALTER TABLE [dbo].[WafCountryRules]  WITH CHECK ADD  CONSTRAINT [CK_WafCountryRules_Action] CHECK  (([Action]='Allow' OR [Action]='Block'))
GO
ALTER TABLE [dbo].[WafCountryRules] CHECK CONSTRAINT [CK_WafCountryRules_Action]
GO
ALTER TABLE [dbo].[WafCustomRules]  WITH CHECK ADD  CONSTRAINT [CK_WafCustomRules_Action] CHECK  (([Action]='LogOnly' OR [Action]='Allow' OR [Action]='Block'))
GO
ALTER TABLE [dbo].[WafCustomRules] CHECK CONSTRAINT [CK_WafCustomRules_Action]
GO
ALTER TABLE [dbo].[WafCustomRules]  WITH CHECK ADD  CONSTRAINT [CK_WafCustomRules_MatchType] CHECK  (([MatchType]='HeaderPattern' OR [MatchType]='UserAgentPattern' OR [MatchType]='UrlPattern'))
GO
ALTER TABLE [dbo].[WafCustomRules] CHECK CONSTRAINT [CK_WafCustomRules_MatchType]
GO
ALTER TABLE [dbo].[WafHealthChecks]  WITH CHECK ADD  CONSTRAINT [CK_WafHealthChecks_Status] CHECK  (([Status]='HttpError' OR [Status]='ConnectionError' OR [Status]='CertificateError' OR [Status]='Slow' OR [Status]='Offline' OR [Status]='Online'))
GO
ALTER TABLE [dbo].[WafHealthChecks] CHECK CONSTRAINT [CK_WafHealthChecks_Status]
GO
ALTER TABLE [dbo].[WafIpRules]  WITH CHECK ADD  CONSTRAINT [CK_WafIpRules_Type] CHECK  (([Type]='Block' OR [Type]='Allow'))
GO
ALTER TABLE [dbo].[WafIpRules] CHECK CONSTRAINT [CK_WafIpRules_Type]
GO
ALTER TABLE [dbo].[WafRateLimitRules]  WITH CHECK ADD  CONSTRAINT [CK_WafRateLimitRules_Action] CHECK  (([Action]='LogOnly' OR [Action]='Challenge' OR [Action]='Block'))
GO
ALTER TABLE [dbo].[WafRateLimitRules] CHECK CONSTRAINT [CK_WafRateLimitRules_Action]
GO
ALTER TABLE [dbo].[WafRules]  WITH CHECK ADD  CONSTRAINT [CK_WafRules_Action] CHECK  (([Action]='RateLimit' OR [Action]='Challenge' OR [Action]='Log' OR [Action]='Block' OR [Action]='Allow'))
GO
ALTER TABLE [dbo].[WafRules] CHECK CONSTRAINT [CK_WafRules_Action]
GO
ALTER TABLE [dbo].[WafRules]  WITH CHECK ADD  CONSTRAINT [CK_WafRules_Mode] CHECK  (([Mode]='Endpoint' OR [Mode]='Application' OR [Mode]='Global'))
GO
ALTER TABLE [dbo].[WafRules] CHECK CONSTRAINT [CK_WafRules_Mode]
GO
ALTER TABLE [dbo].[WafRules]  WITH CHECK ADD  CONSTRAINT [CK_WafRules_Target] CHECK  (([Target]='HttpMethod' OR [Target]='IpAddress' OR [Target]='UserAgent' OR [Target]='Body' OR [Target]='Cookies' OR [Target]='Headers' OR [Target]='QueryString' OR [Target]='Url'))
GO
ALTER TABLE [dbo].[WafRules] CHECK CONSTRAINT [CK_WafRules_Target]
GO
ALTER TABLE [dbo].[WafSettings]  WITH CHECK ADD  CONSTRAINT [CK_WafSettings_SingleRow] CHECK  (([Id]=(1)))
GO
ALTER TABLE [dbo].[WafSettings] CHECK CONSTRAINT [CK_WafSettings_SingleRow]
GO
ALTER TABLE [dbo].[WazuhOfficeAgentVulnerabilities]  WITH CHECK ADD  CONSTRAINT [CK_WOAgentVulns_Status] CHECK  (([Status]='Accepted Risk' OR [Status]='Fixed' OR [Status]='Acknowledged' OR [Status]='Open'))
GO
ALTER TABLE [dbo].[WazuhOfficeAgentVulnerabilities] CHECK CONSTRAINT [CK_WOAgentVulns_Status]
GO
ALTER TABLE [dbo].[WazuhOfficeAlerts]  WITH CHECK ADD  CONSTRAINT [CK_WOAlerts_Status] CHECK  (([Status]='False Positive' OR [Status]='Resolved' OR [Status]='Acknowledged' OR [Status]='Investigating' OR [Status]='New'))
GO
ALTER TABLE [dbo].[WazuhOfficeAlerts] CHECK CONSTRAINT [CK_WOAlerts_Status]
GO
ALTER TABLE [dbo].[WazuhOfficeFileIntegrityEvents]  WITH CHECK ADD  CONSTRAINT [CK_WOFimEvents_ChangeType] CHECK  (([ChangeType]='OwnerChanged' OR [ChangeType]='PermissionChanged' OR [ChangeType]='Deleted' OR [ChangeType]='Modified' OR [ChangeType]='Created'))
GO
ALTER TABLE [dbo].[WazuhOfficeFileIntegrityEvents] CHECK CONSTRAINT [CK_WOFimEvents_ChangeType]
GO
ALTER TABLE [dbo].[WazuhOfficeSettings]  WITH CHECK ADD  CONSTRAINT [CK_WOSettings_SingleRow] CHECK  (([Id]=(1)))
GO
ALTER TABLE [dbo].[WazuhOfficeSettings] CHECK CONSTRAINT [CK_WOSettings_SingleRow]
GO
ALTER TABLE [dbo].[WebhookSettings]  WITH CHECK ADD CHECK  (([Id]=(1)))
GO
ALTER TABLE [dbo].[WifiAccessPointStatus]  WITH CHECK ADD  CONSTRAINT [CK_WifiAccessPointStatus_EnforcementMode] CHECK  (([EnforcementMode]='Enforce' OR [EnforcementMode]='Monitor'))
GO
ALTER TABLE [dbo].[WifiAccessPointStatus] CHECK CONSTRAINT [CK_WifiAccessPointStatus_EnforcementMode]
GO
ALTER TABLE [dbo].[WifiAllowedDevices]  WITH CHECK ADD  CONSTRAINT [CK_WifiAllowedDevices_Source] CHECK  (([Source]='suggested' OR [Source]='manual'))
GO
ALTER TABLE [dbo].[WifiAllowedDevices] CHECK CONSTRAINT [CK_WifiAllowedDevices_Source]
GO
ALTER TABLE [dbo].[WordPressFindings]  WITH CHECK ADD  CONSTRAINT [CK_WordPressFindings_Status] CHECK  (([Status]='FalsePositive' OR [Status]='AcceptedRisk' OR [Status]='Resolved' OR [Status]='InProgress' OR [Status]='Open'))
GO
ALTER TABLE [dbo].[WordPressFindings] CHECK CONSTRAINT [CK_WordPressFindings_Status]
GO
ALTER TABLE [dbo].[WordPressScanSchedules]  WITH CHECK ADD  CONSTRAINT [CK_WordPressScanSchedules_Profile] CHECK  (([Profile]='comprehensive' OR [Profile]='standard' OR [Profile]='quick'))
GO
ALTER TABLE [dbo].[WordPressScanSchedules] CHECK CONSTRAINT [CK_WordPressScanSchedules_Profile]
GO
ALTER TABLE [dbo].[WordPressScanSchedules]  WITH CHECK ADD  CONSTRAINT [CK_WordPressScanSchedules_Recurrence] CHECK  (([Recurrence]='monthly' OR [Recurrence]='weekly' OR [Recurrence]='daily'))
GO
ALTER TABLE [dbo].[WordPressScanSchedules] CHECK CONSTRAINT [CK_WordPressScanSchedules_Recurrence]
GO
ALTER DATABASE [LogMonitor] SET  READ_WRITE 
GO
