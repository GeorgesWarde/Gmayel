using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using System.Data.SqlClient;
namespace clinicHealth.Pages.AdminPage
{
    public class editDoctorModel : PageModel
    {
        public Users user = new Users();
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
                    String doctorQuery = "Select * from users where id=@id ";
                    using (SqlCommand command = new SqlCommand(doctorQuery, connection))
                    {
                        command.Parameters.AddWithValue("@id", Convert.ToInt32(id));
                        using (SqlDataReader reader = command.ExecuteReader())
                            if (reader.Read())
                            {

                                user.id = reader.GetInt32(0);
                                user.full_name = reader.GetString(1);
                                user.username = reader.GetString(2);
                                user.age = reader.GetInt32(3);
                                user.Gender = reader.GetString(4);
                                user.password = reader.GetString(6);
                               

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

            user.id = Convert.ToInt32(Request.Form["id"]);
            user.full_name = Request.Form["name"];
            user.username = Request.Form["username"];
            user.age = Convert.ToInt32(Request.Form["Age"]);
            user.Gender = Request.Form["Gender"];
            user.password = Request.Form["password"];
            

            try
            {
                String connectionString = "Data Source=.;Initial Catalog=Clinic;Integrated Security=True";
                using (SqlConnection connection = new SqlConnection(connectionString))
                {
                    connection.Open();
                    String doctorQuery = "UPDATE users SET full_name=@name,username=@username,age=@age,Gender=@Gender WHERE id=@id";
                    using (SqlCommand command = new SqlCommand(doctorQuery, connection))
                    {
                        command.Parameters.AddWithValue("@name", user.full_name);
                        command.Parameters.AddWithValue("@username", user.username);
                        command.Parameters.AddWithValue("@age", user.age);
                        command.Parameters.AddWithValue("@Gender", user.Gender);
                       
                        command.Parameters.AddWithValue("@id", user.id);

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
