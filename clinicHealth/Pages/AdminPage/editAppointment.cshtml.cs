using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using System.Data.SqlClient;
namespace clinicHealth.Pages.AdminPage
{
    public class editAppointmentModel : PageModel
    {
        public Appointments appoint = new Appointments();
        public String errorMessage = "";
        public String successMessage = "";
        public void OnGet()
        {
            String id = Request.Query["id"];
            try
            {
                String connectionString = "Data Source=.;Initial Catalog=Clinic;Integrated Security=True";
                using (SqlConnection connection = new SqlConnection(connectionString))
                {
                    connection.Open();
                    String doctorQuery = "Select * from Appoint  where id=@id ";
                    using (SqlCommand command = new SqlCommand(doctorQuery, connection))
                    {
                        command.Parameters.AddWithValue("@id", Convert.ToInt32(id));
                        using (SqlDataReader reader = command.ExecuteReader())
                            if (reader.Read())
                            {

                                appoint.id = reader.GetInt32(0);
                                appoint.full_name = reader.GetString(1);
                                appoint.appointment_date = reader.GetString(2);
                                appoint.hour = reader.GetString(3);


                            }
                    }
                }
            }
            catch (Exception ex)
            {
                errorMessage = ex.Message;
            }


        }
        public void OnPost()
        {

            appoint.id = Convert.ToInt32(Request.Form["id"]);
            appoint.full_name = Request.Form["name"];
            appoint.appointment_date = Request.Form["visit"];
            appoint.hour = Request.Form["hour"];
           
            try
            {
                String connectionString = "Data Source=.;Initial Catalog=Clinic;Integrated Security=True";
                using (SqlConnection connection = new SqlConnection(connectionString))
                {
                    connection.Open();
                    String doctorQuery = "UPDATE Appoint SET full_name=@name,appointment_date=@visit,hour=@hour WHERE id=@id";
                    using (SqlCommand command = new SqlCommand(doctorQuery, connection))
                    {
                        command.Parameters.AddWithValue("@name", appoint.full_name);
                        command.Parameters.AddWithValue("@visit", appoint.appointment_date);
                        command.Parameters.AddWithValue("@hour", appoint.hour); 
                        command.Parameters.AddWithValue("@id", appoint.id);

                        command.ExecuteNonQuery();
                    }
                }

            }
            catch (Exception ex)
            {
                errorMessage = ex.Message;
                return;
            }
            Response.Redirect("/AdminPage/doctors?id=" + Convert.ToInt32(Request.Query["id"]) + "");
        }
    }
}
