using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using System.Data.SqlClient;
namespace clinicHealth.Pages.AdminPage
{
    public class createAppointmentModel : PageModel
    {
        public Appointments appointment = new Appointments();
        public String errorMessage = "";
        public String successMessage = "";
        public void OnGet()
        {
        }
        public void OnPost()
        {
            String id = Request.Query["id"];
            appointment.full_name = Request.Form["name"];
            appointment.appointment_date = Request.Form["date"];
            appointment.hour = Request.Form["hour"];
           
            if (appointment.full_name.Length == 0 || appointment.appointment_date.Length == 0 || appointment.hour.Length == 0)
            {
                errorMessage = "All Fields are Required";
                return;

            }
            try
            {
                String connectionString = "Data Source=.;Initial Catalog=Clinic;Integrated Security=True";
                using (SqlConnection connection = new SqlConnection(connectionString))
                {
                    connection.Open();
                    String query = "INSERT INTO Appoint" +
                                   "(full_name,appointment_date,user_id,hour) VALUES " +
                                   "(@full_name,@date,@user_id,@hour);";
                    using (SqlCommand command = new SqlCommand(query, connection))
                    {
                        command.Parameters.AddWithValue("@full_name", appointment.full_name);
                        command.Parameters.AddWithValue("@date", appointment.appointment_date);
                        command.Parameters.AddWithValue("@hour", appointment.hour);
                        command.Parameters.AddWithValue("@user_id", id);
                        command.ExecuteNonQuery();
                    }
                }

            }
            catch (Exception ex)
            {
                errorMessage = ex.Message;
                return;

            }
            appointment.full_name = ""; appointment.appointment_date = ""; appointment.hour = "";
            successMessage = "New Docotr has Been Added!";
            Response.Redirect("/AdminPage/doctors");
        }
    }
}
