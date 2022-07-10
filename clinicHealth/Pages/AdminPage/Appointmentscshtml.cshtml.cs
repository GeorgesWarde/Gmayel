using Microsoft.AspNetCore.Mvc.RazorPages;
using System.Data.SqlClient;
namespace clinicHealth.Pages.AdminPage
{
    public class AppointmentscshtmlModel : PageModel
    {
        public List<Appointments> listAppointments = new List<Appointments>();
        public void OnGet()
        {
            try
            {
                String connectionString = "Data Source=.;Initial Catalog=Clinic;Integrated Security=True";
                using (SqlConnection connection = new SqlConnection(connectionString))
                {
                    connection.Open();
                    String doctorQuery = "Select * from Appoint";
                    using (SqlCommand command = new SqlCommand(doctorQuery, connection))
                    {
                        using (SqlDataReader reader = command.ExecuteReader())
                            while (reader.Read())
                            {
                                Appointments appointment = new Appointments();
                                appointment.id = reader.GetInt32(0);
                                appointment.full_name = reader.GetString(1);
                                appointment.appointment_date = reader.GetString(2);
                                appointment.user_id = reader.GetInt32(3);
                                appointment.hour = reader.GetString(4);
                               
                            
                              
                                                listAppointments.Add(appointment);

                            }
                    }
                }
            }
            catch (Exception ex)
            {

            }
        }
        public void OnPost()
        {
            String doctorName = Request.Form["name"];
            try
            {
                String connectionString = "Data Source=.;Initial Catalog=Clinic;Integrated Security=True";
                using (SqlConnection connection = new SqlConnection(connectionString))
                {
                    connection.Open();
                    String doctorQuery = "Select * from Appoint where full_name LIKE @name";//Select all doctors 
                    using (SqlCommand command = new SqlCommand(doctorQuery, connection))
                    {
                        command.Parameters.AddWithValue("@name", doctorName);
                        using (SqlDataReader reader = command.ExecuteReader())
                            while (reader.Read())
                            {
                                listAppointments.Clear();
                                Appointments appoint = new Appointments();
                                appoint.id = reader.GetInt32(0);
                                appoint.full_name = reader.GetString(1);
                                appoint.appointment_date = reader.GetString(2);
                                appoint.hour = reader.GetString(4);
                                listAppointments.Add(appoint);
                            }
                    }
                }
            }
            catch (Exception ex)
            {

            }
        }
    }
    public class Appointments
    {
        public int id;
        public String full_name;
        public String appointment_date;
        public int user_id;
        public String hour;
        public String doctor_name;

    }
}
