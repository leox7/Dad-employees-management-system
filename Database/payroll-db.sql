-- =========================================
-- Payroll System Database Schema (v2)
-- Drop and recreate from scratch
-- =========================================

DROP DATABASE IF EXISTS payroll_db;
CREATE DATABASE payroll_db;
USE payroll_db;

-- ---------------------------------------
-- Users (2 seeded users: dad + admin)
-- ---------------------------------------
CREATE TABLE users (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    username        VARCHAR(100) NOT NULL,
    email           VARCHAR(150) NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------
-- Employees
-- Note: no hard delete — "deleting" an employee means
-- setting status = 'inactive'. History must never be lost.
-- ---------------------------------------
CREATE TABLE employees (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    name            VARCHAR(150) NOT NULL,
    phone           VARCHAR(20) NOT NULL,
    salary          DECIMAL(12,2) NOT NULL,
    status          ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------
-- Payroll Runs (one per month/year)
-- ---------------------------------------
CREATE TABLE payroll_runs (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    month           TINYINT NOT NULL,          -- 1-12
    year            SMALLINT NOT NULL,
    status          ENUM('draft', 'approved', 'locked') NOT NULL DEFAULT 'draft',
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    approved_at     TIMESTAMP NULL,
    UNIQUE KEY uq_month_year (month, year)      -- only one payroll run per month
);

-- ---------------------------------------
-- Loans (recorded real-time, deducted manually)
-- employee_id uses RESTRICT — cannot hard-delete an
-- employee who has loan history.
-- ---------------------------------------
CREATE TABLE loans (
    id                  INT AUTO_INCREMENT PRIMARY KEY,
    employee_id         INT NOT NULL,
    loan_amount         DECIMAL(12,2) NOT NULL,
    outstanding_amount  DECIMAL(12,2) NOT NULL,
    date_taken          DATE NOT NULL,
    status              ENUM('active', 'paid') NOT NULL DEFAULT 'active',
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE RESTRICT
);

-- ---------------------------------------
-- Loan Repayments (created only at payroll approval, or manual)
-- ---------------------------------------
CREATE TABLE loan_repayments (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    loan_id         INT NOT NULL,
    amount          DECIMAL(12,2) NOT NULL,
    payment_date    DATE NOT NULL,
    payroll_run_id  INT NULL,                   -- NULL if repayment was manual, outside payroll
    FOREIGN KEY (loan_id) REFERENCES loans(id) ON DELETE CASCADE,
    FOREIGN KEY (payroll_run_id) REFERENCES payroll_runs(id) ON DELETE SET NULL
);

-- ---------------------------------------
-- Salary Advances (recorded real-time, auto-deducted at payroll)
-- employee_id uses RESTRICT — same protection as loans.
-- ---------------------------------------
CREATE TABLE salary_advances (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    employee_id     INT NOT NULL,
    amount          DECIMAL(12,2) NOT NULL,
    advance_date    DATE NOT NULL,
    month           TINYINT NOT NULL,           -- which payroll month this applies to
    year            SMALLINT NOT NULL,
    payroll_run_id  INT NULL,                   -- set once consumed by a payroll run
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE RESTRICT,
    FOREIGN KEY (payroll_run_id) REFERENCES payroll_runs(id) ON DELETE SET NULL
);

-- ---------------------------------------
-- Payroll Lines (per-employee breakdown per run — immutable once approved)
-- employee_id uses RESTRICT — same protection as loans/advances.
-- ---------------------------------------
CREATE TABLE payroll_lines (
    id                  INT AUTO_INCREMENT PRIMARY KEY,
    payroll_run_id      INT NOT NULL,
    employee_id         INT NOT NULL,
    gross_salary        DECIMAL(12,2) NOT NULL,   -- snapshot of salary at run time
    loan_deduction      DECIMAL(12,2) NOT NULL DEFAULT 0,   -- manual entry
    advance_deduction   DECIMAL(12,2) NOT NULL DEFAULT 0,   -- auto-calculated
    net_salary          DECIMAL(12,2) NOT NULL,   -- can go negative (warning handled in app logic)
    FOREIGN KEY (payroll_run_id) REFERENCES payroll_runs(id) ON DELETE CASCADE,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE RESTRICT,
    UNIQUE KEY uq_run_employee (payroll_run_id, employee_id)   -- one line per employee per run
);

-- ---------------------------------------
-- Helpful indexes for common lookups
-- ---------------------------------------
CREATE INDEX idx_loans_employee ON loans(employee_id);
CREATE INDEX idx_advances_employee_month ON salary_advances(employee_id, year, month);
CREATE INDEX idx_payroll_lines_run ON payroll_lines(payroll_run_id);
CREATE INDEX idx_loan_repayments_loan ON loan_repayments(loan_id);

ALTER TABLE payroll_runs 
MODIFY COLUMN status ENUM('draft', 'approved', 'locked') NOT NULL DEFAULT 'draft';