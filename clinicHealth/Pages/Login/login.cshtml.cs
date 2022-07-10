using clinicHealth.Pages.AdminPage;
using Microsoft.AspNetCore.Mvc.RazorPages;
using System.Data;
using System.Data.SqlClient;
namespace clinicHealth.Pages.Login
{
    public class loginModel : PageModel
    {
        public Users user = new Users();
        public String errorMessage = "";
        public String successMessage = "";
        int role_id;
        int id;
        public void OnPost()
        {
            user.username = Request.Form["username"];
            user.password = Request.Form["password"];
            if (user.username.Length == 0 || user.password.Length == 0)
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
                    String query = "Select * from users where username=@username and password=@password";
                    using (SqlCommand command = new SqlCommand(query, connection))
                    {
                        command.Parameters.AddWithValue("@username", user.username);
                        command.Parameters.AddWithValue("@password", user.password);
                        SqlDataReader reader = command.ExecuteReader();
                       
                        if (reader.HasRows)
                        {
                            while (reader.Read())
                            {
                                id = reader.GetInt32(0);
                                
                                role_id = reader.GetInt32(5);
                            }
                            if (role_id == 2)
                            {
                                Response.Redirect("/DoctorPage/patient?id="+id+"");
                            }
                            if(role_id == 1)
                            {
                                Response.Redirect("/AdminPage/doctors");
                            }
                        }
                        else
                        {

                            errorMessage = "Wrong username or password please try again";
                           
                        }

                    }
                }
            }
            catch (Exception ex)
            {
                errorMessage = ex.Message;
            }
        }
    }
}