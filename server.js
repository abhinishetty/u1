const express = require('express');
const bodyParser = require('body-parser');
const mysql = require('mysql');

// Initialize the Express app
const app = express();

// Use body-parser middleware to parse incoming request bodies
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());  // For parsing JSON bodies
app.use(express.static('public')); // Serve static files like HTML, CSS, and JS

// MySQL connection configuration
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '', // Make sure your password is correct
  database: 'emp' // Replace 'emp' with your actual database name
});

// Connect to the database
db.connect(err => {
  if (err) {
    console.error('Error connecting to the database:', err);
    process.exit(1);
  }
  console.log('Connected to the database.');
});

// Serve the login page
app.get('/', (req, res) => {
  console.log('Serving login page');
  res.sendFile(__dirname + '/login.html');
});

// Handle login requests (for both managers and employees)
app.post('/login', (req, res) => {
  const { UserId, Password, Role } = req.body;
  console.log('Login attempt:', { UserId, Role });

  let query;
  if (Role === 'Manager') {
    query = 'SELECT * FROM manager WHERE ManagerId = ?';
  } else if (Role === 'Employee') {
    query = 'SELECT * FROM employee WHERE EmpId = ?';
  } else {
    console.log('Invalid Role:', Role);
    return res.status(400).send('<h1>Invalid Role Selected</h1>');
  }

  // Query the database
  db.query(query, [UserId], (err, results) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).send('<h1>An error occurred. Please try again later.</h1>');
    }

    if (results.length > 0) {
      const user = results[0];

      // Compare password directly without hashing
      if (Password === user.Password) {
        console.log(`Login successful for ${Role} ${UserId}`);
        if (Role === 'Manager') {
          res.sendFile(__dirname + '/manager-dashboard.html');
        } else {
          res.sendFile(__dirname + '/employee-dashboard.html');
        }
      } else {
        console.log('Incorrect password for', UserId);
        res.send('<h1>Login failed. Incorrect password.</h1>');
      }
    } else {
      console.log('User ID not found:', UserId);
      res.send('<h1>Login failed. User ID not found.</h1>');
    }
  });
});

// Route to submit a leave request (accessible by employees)
app.post('/submit-leave-request', (req, res) => {
  const { EmpId, LeaveType, StartDate, EndDate } = req.body;
  console.log('Leave request submission:', { EmpId, LeaveType, StartDate, EndDate });

  if (!EmpId || !LeaveType || !StartDate || !EndDate) {
    console.log('Missing required fields in leave request');
    return res.status(400).json({ message: 'EmpId, LeaveType, StartDate, and EndDate are required.' });
  }
  // Insert leave request into the database
  const query = `
    INSERT INTO leaverequest (EmpId, LeaveType, StartDate, EndDate, Status)
    VALUES (?, ?, ?, ?, 'Pending')
  `;
  const values = [EmpId, LeaveType, StartDate, EndDate];

  db.query(query, values, (err, result) => {
    if (err) {
      console.error('Error submitting leave request:', err);
      return res.status(500).json({ message: 'Failed to submit leave request. Please try again later.' });
    }
    console.log('Leave request submitted successfully for EmpId:', EmpId);
    res.json({ message: 'Leave request submitted successfully!' });
  });
});

// Route to view all leave requests (accessible by managers)
app.get('/view-leave-requests', (req, res) => {
  const { ManagerId } = req.query;
  console.log('View leave requests for ManagerId:', ManagerId);

  if (!ManagerId) {
    console.log('ManagerId is missing');
    return res.status(400).json({ message: 'ManagerId is required.' });
  }

  // Ensure the ManagerId exists in the manager table
  const managerQuery = 'SELECT * FROM manager WHERE ManagerId = ?';
  db.query(managerQuery, [ManagerId], (err, managerResults) => {
    if (err) {
      console.error('Database error while checking manager:', err);
      return res.status(500).json({ message: 'Database error.' });
    }

    if (managerResults.length === 0) {
      console.log('ManagerId not found:', ManagerId);
      return res.status(400).json({ message: 'Manager ID does not exist.' });
    }

    console.log('Manager found, fetching leave requests');
    // Fetch all leave requests
    const query = `
      SELECT lr.*, e.Name 
      FROM leaverequest lr 
      JOIN employee e ON lr.EmpId = e.EmpId
    `;
    db.query(query, (err, results) => {
      if (err) {
        console.error('Error fetching leave requests:', err);
        return res.status(500).json({ message: 'Database error.' });
      }
      console.log('Leave requests retrieved:', results.length);
      res.json(results);
    });
  });
});

// Route to update the status of a leave request (accessible by managers)
app.put('/update-leave-request', (req, res) => {
  const { ManagerId, RequestId, Status } = req.body;
  console.log('Update leave request:', { ManagerId, RequestId, Status });

  if (!ManagerId || !RequestId || !Status) {
    console.log('Missing required fields in leave request update');
    return res.status(400).json({ message: 'ManagerId, RequestId, and Status are required.' });
  }

  // Ensure the ManagerId exists in the manager table
  const managerQuery = 'SELECT * FROM manager WHERE ManagerId = ?';
  db.query(managerQuery, [ManagerId], (err, managerResults) => {
    if (err) {
      console.error('Database error while checking manager:', err);
      return res.status(500).json({ message: 'Database error.' });
    }

    if (managerResults.length === 0) {
      console.log('ManagerId not found:', ManagerId);
      return res.status(400).json({ message: 'Manager ID does not exist.' });
    }

    // Update the leave request status
    const query = 'UPDATE leaverequest SET Status = ? WHERE RequestId = ?';
    db.query(query, [Status, RequestId], (err, result) => {
      if (err) {
        console.error('Error updating leave request:', err);
        return res.status(500).json({ message: 'Failed to update leave request. Please try again later.' });
      }

      if (result.affectedRows === 0) {
        console.log('Leave request not found:', RequestId);
        return res.status(404).json({ message: 'Leave request not found.' });
      }

      console.log('Leave request updated successfully:', RequestId);
      res.json({ message: 'Leave request updated successfully!' });
    });
  });
});

// Route to fetch all employees (accessible by managers)
app.get('/employees', (req, res) => {
  console.log('Fetching all employees');
  const query = 'SELECT * FROM employee';
  db.query(query, (err, results) => {
    if (err) {
      console.error('Error fetching employees:', err);
      return res.status(500).json({ error: 'Database error' });
    }

    console.log('Employees retrieved:', results.length);
    res.json(results); // Return employee data as JSON
  });
});

// Route to add a new employee (accessible by managers)
app.post('/add-employee', (req, res) => {
  const { EmpId, Name, JobRole, Salary, ContactInfo, HireDate, ManagerId, Password } = req.body;
  console.log('Add employee request:', { EmpId, Name, JobRole, Salary, ContactInfo, HireDate, ManagerId });

  // Check if all required fields are provided
  if (!EmpId || !Name || !JobRole || !Salary || !ContactInfo || !HireDate || !ManagerId || !Password) {
    console.log('Missing required fields for adding employee');
    return res.status(400).send('<h1>Missing required fields</h1>');
  }

  // Check if EmpId already exists
  const empQuery = 'SELECT * FROM employee WHERE EmpId = ?';
  db.query(empQuery, [EmpId], (err, empResults) => {
    if (err) {
      console.error('Database error while checking EmpId:', err);
      return res.status(500).send('<h1>An error occurred. Please try again later.</h1>');
    }

    if (empResults.length > 0) {
      console.log('Employee ID already exists:', EmpId);
      return res.status(400).send('<h1>Employee ID already exists.</h1>');
    }

    // Check if ManagerId exists in the manager table
    const managerQuery = 'SELECT * FROM manager WHERE ManagerId = ?';
    db.query(managerQuery, [ManagerId], (err, managerResults) => {
      if (err) {
        console.error('Database error while checking ManagerId:', err);
        return res.status(500).send('<h1>An error occurred. Please try again later.</h1>');
      }

      if (managerResults.length === 0) {
        console.log('Manager ID does not exist:', ManagerId);
        return res.status(400).send('<h1>Manager ID does not exist.</h1>');
      }

      // SQL query to insert a new employee
      const query = `
        INSERT INTO employee (EmpId, Name, JobRole, Salary, ContactInfo, HireDate, ManagerId, Password)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `;
      const values = [EmpId, Name, JobRole, Salary, ContactInfo, HireDate, ManagerId, Password];

      db.query(query, values, (err, result) => {
        if (err) {
          console.error('Error adding employee:', err);
          return res.status(500).send('<h1>Failed to add employee. Please try again later.</h1>');
        }
        console.log('Employee added successfully:', EmpId);
        res.send('<h1>Employee added successfully!</h1>');
      });
    });
  });
});

// Route to fetch employee's payscale (accessible by employees)
app.get('/get-salary-slip', (req, res) => {
  const { EmpId } = req.query;
  console.log('Fetching salary slip for EmpId:', EmpId);

  if (!EmpId) {
    console.log('EmpId is missing');
    return res.status(400).json({ message: 'EmpId is required' });
  }

  const query = 'SELECT * FROM payscale WHERE EmpId = ?';
  db.query(query, [EmpId], (err, results) => {
    if (err) {
      console.error('Error fetching salary slip:', err);
      return res.status(500).json({ message: 'Database error' });
    }

    if (results.length > 0) {
      console.log('Salary slip found for EmpId:', EmpId);
      res.json(results[0]);
    } else {
      console.log('Salary slip not found for EmpId:', EmpId);
      res.status(404).json({ message: 'Salary slip not found' });
    }
  });
});

// Route to delete an employee (accessible by managers)
app.delete('/delete-employee', (req, res) => {
  const { EmpId, ManagerId } = req.body;
  console.log('Delete employee request:', { EmpId, ManagerId });

  // Check if EmpId and ManagerId are provided
  if (!EmpId || !ManagerId) {
    console.log('Missing EmpId or ManagerId for delete request');
    return res.status(400).json({ message: 'EmpId and ManagerId are required' });
  }

  // Ensure ManagerId exists
  const managerQuery = 'SELECT * FROM manager WHERE ManagerId = ?';
  db.query(managerQuery, [ManagerId], (err, managerResults) => {
    if (err) {
      console.error('Error checking manager:', err);
      return res.status(500).json({ message: 'Database error' });
    }

    if (managerResults.length === 0) {
      console.log('Manager not found:', ManagerId);
      return res.status(400).json({ message: 'Manager not found' });
    }

    // Delete employee record
    const query = 'DELETE FROM employee WHERE EmpId = ?';
    db.query(query, [EmpId], (err, result) => {
      if (err) {
        console.error('Error deleting employee:', err);
        return res.status(500).json({ message: 'Error deleting employee' });
      }

      if (result.affectedRows === 0) {
        console.log('Employee not found for deletion:', EmpId);
        return res.status(404).json({ message: 'Employee not found' });
      }

      console.log('Employee deleted successfully:', EmpId);
      res.json({ message: 'Employee deleted successfully!' });
    });
  });
});

// Start the server
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
